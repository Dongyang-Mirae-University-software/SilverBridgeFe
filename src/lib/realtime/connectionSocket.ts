import { AuthRole, getAccessToken } from '@/lib/auth/tokenStore';

type ConnectionRealtimeType =
  | 'CONNECTION_REQUEST'
  | 'CONNECTION_ACCEPTED'
  | 'CONNECTION_REFUSED'
  | 'CONNECTION_CANCELLED'
  | 'CONNECTION_DISCONNECTED'
  | 'DISCONNECTION';

export interface ConnectionRealtimePayload {
  type: ConnectionRealtimeType;
  title?: string;
  body?: string;
  connectionId?: string;
}

interface ConnectConnectionSocketOptions {
  onMessage: (payload: ConnectionRealtimePayload) => void;
  role: AuthRole;
  userId: string;
}

const DEFAULT_SOCKET_URL = 'wss://api.dmu.gosky.kr/ws';
const STOMP_SUBPROTOCOLS = ['v12.stomp', 'v11.stomp', 'v10.stomp'];

function getSocketUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_WS_URL;

  const url = new URL(explicitUrl || DEFAULT_SOCKET_URL);
  return url.toString();
}

function buildFrame(command: string, headers: Record<string, string> = {}, body = '') {
  const headerLines = Object.entries(headers).map(([key, value]) => `${key}:${value}`);
  return [command, ...headerLines, '', body].join('\n') + '\0';
}

function parseFrame(rawFrame: string) {
  const frame = rawFrame.replace(/\r\n/g, '\n').replace(/\0$/, '');
  const [head = '', ...bodyParts] = frame.split('\n\n');
  const [command = '', ...headerLines] = head.split('\n');
  const headers = Object.fromEntries(
    headerLines
      .map(line => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex < 0) return null;
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );

  return {
    body: bodyParts.join('\n\n'),
    command,
    headers,
  };
}

function getSubscriptionDestinations(role: AuthRole, userId: string) {
  if (role === 'WARD') {
    return [`/topic/${userId}/connection-request`];
  }

  return [
    `/topic/${userId}/connection-accepted`,
    `/topic/${userId}/connection-refused`,
    `/topic/${userId}/connection-cancelled`,
    `/topic/${userId}/disconnection`,
  ];
}

function normalizeMessage(body: string, fallbackType: ConnectionRealtimeType): ConnectionRealtimePayload {
  if (!body) return { type: fallbackType };

  try {
    const parsed = JSON.parse(body) as Partial<ConnectionRealtimePayload> & {
      message?: string;
      notification?: { body?: string; title?: string };
    };

    return {
      body: parsed.body ?? parsed.message ?? parsed.notification?.body,
      connectionId: parsed.connectionId,
      title: parsed.title ?? parsed.notification?.title,
      type: parsed.type ?? fallbackType,
    };
  } catch {
    return {
      body,
      type: fallbackType,
    };
  }
}

function getFallbackType(destination?: string): ConnectionRealtimeType {
  if (destination?.includes('connection-request')) return 'CONNECTION_REQUEST';
  if (destination?.includes('connection-accepted')) return 'CONNECTION_ACCEPTED';
  if (destination?.includes('connection-refused')) return 'CONNECTION_REFUSED';
  if (destination?.includes('connection-cancelled')) return 'CONNECTION_CANCELLED';
  return 'CONNECTION_DISCONNECTED';
}

export function connectConnectionSocket({ onMessage, role, userId }: ConnectConnectionSocketOptions) {
  const accessToken = getAccessToken();
  const socketUrl = getSocketUrl();
  console.debug('[WS] 연결 시도:', socketUrl);
  const socket = new WebSocket(socketUrl, STOMP_SUBPROTOCOLS);
  let connected = false;

  socket.addEventListener('open', () => {
    socket.send(
      buildFrame('CONNECT', {
        'accept-version': '1.2',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'heart-beat': '10000,10000',
      }),
    );
  });

  socket.addEventListener('message', event => {
    const frames = String(event.data).split('\0').filter(Boolean);

    frames.forEach(rawFrame => {
      const frame = parseFrame(`${rawFrame}\0`);

      if (frame.command === 'CONNECTED' && !connected) {
        connected = true;
        getSubscriptionDestinations(role, userId).forEach((destination, index) => {
          socket.send(
            buildFrame('SUBSCRIBE', {
              ack: 'auto',
              destination,
              id: `connection-${role.toLowerCase()}-${index}`,
            }),
          );
        });
        return;
      }

      if (frame.command === 'MESSAGE') {
        onMessage(normalizeMessage(frame.body, getFallbackType(frame.headers.destination)));
      }
    });
  });

  socket.addEventListener('error', () => {
    console.warn('[WS] 연결 오류 발생 — 브라우저 Network 탭의 WS 요청 status와 close code를 확인하세요.');
  });

  socket.addEventListener('close', event => {
    console.warn('[WS] 연결 종료 — code:', event.code, '| wasClean:', event.wasClean, '| reason:', event.reason || '(없음)');
  });

  return () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(buildFrame('DISCONNECT'));
    }
    socket.close();
  };
}
