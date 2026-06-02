import { Client, IMessage } from '@stomp/stompjs';

import { AuthRole, getAccessToken } from '@/lib/auth/tokenStore';
import { savePendingConnectionRequest } from './pendingConnectionRequests';

type ConnectionRealtimeType = 'CONNECTION_REQUEST' | 'CONNECTION_ACCEPTED' | 'CONNECTION_CANCELLED' | 'CONNECTION_REFUSED';

export interface ConnectionRealtimePayload {
  type: ConnectionRealtimeType;
  title?: string;
  body?: string;
  connectionId?: string;
  from?: string;
}

interface ConnectConnectionSocketOptions {
  onMessage: (payload: ConnectionRealtimePayload) => void;
  role: AuthRole;
  userId: string;
}

const DEFAULT_SOCKET_URL = 'wss://api.devdmu.gosky.kr/ws';
const RECONNECT_DELAY_MS = 5000;

const WARD_CONNECTION_TOPICS: Array<{ destination: string; type: ConnectionRealtimeType }> = [
  { destination: 'connection-request', type: 'CONNECTION_REQUEST' },
  { destination: 'connection-cancelled', type: 'CONNECTION_CANCELLED' },
];

const GUARDIAN_CONNECTION_TOPICS: Array<{ destination: string; type: ConnectionRealtimeType }> = [
  { destination: 'connection-accepted', type: 'CONNECTION_ACCEPTED' },
  { destination: 'connection-refused', type: 'CONNECTION_REFUSED' },
  { destination: 'connection-cancelled', type: 'CONNECTION_CANCELLED' },
];

function getSocketUrl(accessToken: string) {
  const explicitUrl = process.env.NEXT_PUBLIC_WS_URL;
  const url = new URL(explicitUrl || DEFAULT_SOCKET_URL);
  url.searchParams.set('token', accessToken);
  return url.toString();
}

function maskSocketUrl(url: string) {
  const maskedUrl = new URL(url);
  if (maskedUrl.searchParams.has('token')) maskedUrl.searchParams.set('token', '***');
  return maskedUrl.toString();
}

function normalizeMessage(message: IMessage, fallbackType: ConnectionRealtimeType): ConnectionRealtimePayload {
  if (!message.body) return { type: fallbackType };

  try {
    const parsed = JSON.parse(message.body) as {
      body?: string;
      connectionId?: number | string;
      from?: string;
      message?: string;
      notification?: { body?: string; title?: string };
      title?: string;
      type?: ConnectionRealtimeType;
    };

    return {
      body: parsed.body ?? parsed.message ?? parsed.notification?.body,
      connectionId: parsed.connectionId === undefined ? undefined : String(parsed.connectionId),
      from: parsed.from,
      title: parsed.title ?? parsed.notification?.title,
      type: parsed.type ?? fallbackType,
    };
  } catch {
    return {
      body: message.body,
      type: fallbackType,
    };
  }
}

export function connectConnectionSocket({ onMessage, role, userId }: ConnectConnectionSocketOptions) {
  const accessToken = getAccessToken();

  if (!accessToken) {
    console.warn('[WS] accessToken이 없어 연결 WebSocket을 시작하지 않았습니다.');
    return () => {};
  }

  if (!userId) {
    console.warn('[WS] userId가 없어 연결 WebSocket 구독을 시작하지 않았습니다.');
    return () => {};
  }

  let currentAccessToken = accessToken;
  let currentBrokerURL = getSocketUrl(accessToken);
  const client = new Client({
    brokerURL: currentBrokerURL,
    reconnectDelay: RECONNECT_DELAY_MS,
    beforeConnect: () => {
      const latestAccessToken = getAccessToken();
      if (!latestAccessToken) {
        void client.deactivate();
        return;
      }

      currentAccessToken = latestAccessToken;
      currentBrokerURL = getSocketUrl(latestAccessToken);
      client.brokerURL = currentBrokerURL;
    },
    debug: message => {
      console.debug('[WS]', message.replace(currentAccessToken, '***'));
    },
  });

  client.onConnect = () => {
    console.info('[WS] CONNECTED - 구독 시작:', maskSocketUrl(currentBrokerURL), '| userId:', userId);

    const topics = role === 'WARD' ? WARD_CONNECTION_TOPICS : role === 'GUARDIAN' ? GUARDIAN_CONNECTION_TOPICS : [];

    topics.forEach(topic => {
      const destination = `/topic/${userId}/${topic.destination}`;
      console.info('[WS] SUBSCRIBE:', destination);

      client.subscribe(destination, message => {
        const payload = normalizeMessage(message, topic.type);
        console.info('[WS] 알림 받음:', payload);
        if (role === 'WARD' && payload.type === 'CONNECTION_REQUEST') savePendingConnectionRequest(payload);
        onMessage(payload);
      });
    });
  };

  client.onStompError = frame => {
    console.warn('[WS] STOMP ERROR:', frame.headers.message || frame.body || '(메시지 없음)');
  };

  client.onWebSocketError = () => {
    console.warn('[WS] WebSocket 연결 오류가 발생했습니다.');
  };

  client.onWebSocketClose = event => {
    console.warn('[WS] 연결 종료 — code:', event.code, '| wasClean:', event.wasClean, '| reason:', event.reason || '(없음)');
  };

  client.activate();
  if (typeof window !== 'undefined') {
    (window as Window & { __connectionStompClient?: Client }).__connectionStompClient = client;
  }

  return () => {
    if (typeof window !== 'undefined') {
      const debugWindow = window as Window & { __connectionStompClient?: Client };
      if (debugWindow.__connectionStompClient === client) delete debugWindow.__connectionStompClient;
    }
    void client.deactivate();
  };
}
