import { Client, IMessage } from '@stomp/stompjs';

import { AuthRole, getAccessToken } from '@/lib/auth/tokenStore';
import { savePendingConnectionRequest } from './pendingConnectionRequests';

type ConnectionRealtimeType =
  | 'CONNECTION_REQUEST'
  | 'CONNECTION_ACCEPTED'
  | 'CONNECTION_CANCELLED'
  | 'CONNECTION_REFUSED'
  | 'SOS_TRIGGERED'
  | 'MEDICATION_TAKEN'
  | 'MEDICATION_STOPPED'
  | 'ANOMALY_DETECTED'
  | 'CAMERA_ANALYSIS';

export interface ConnectionRealtimePayload {
  type: ConnectionRealtimeType;
  title?: string;
  body?: string;
  connectionId?: string;
  from?: string;
  sosEventId?: string;
  wardId?: string;
  wardName?: string;
  medicationId?: string;
  medicationName?: string;
  doseDate?: string;
  taken?: string;
  takenAt?: string;
  stoppedCount?: string;
  location?: string;
  detectedType?: string;
  detectedTypeLabel?: string;
  sessionId?: string;
  anomalyEventId?: string;
  incidentId?: string;
  detectedAt?: string;
  // camera-analysis 전용(카메라 실시간 분석 상태) — 토스트/알림음 없이 화면 표시에만 쓴다.
  // status는 null이면 "꺼짐"이 아니라 "지금 확인 불가"라서 undefined와 구분해야 한다
  status?: string | null;
  confidence?: string;
  danger?: string;
  analyzedAt?: string;
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
  { destination: 'medication-taken', type: 'MEDICATION_TAKEN' },
  { destination: 'anomaly-detected', type: 'ANOMALY_DETECTED' },
];

const GUARDIAN_CONNECTION_TOPICS: Array<{ destination: string; type: ConnectionRealtimeType }> = [
  { destination: 'connection-accepted', type: 'CONNECTION_ACCEPTED' },
  { destination: 'connection-refused', type: 'CONNECTION_REFUSED' },
  { destination: 'connection-cancelled', type: 'CONNECTION_CANCELLED' },
  { destination: 'sos-triggered', type: 'SOS_TRIGGERED' },
  { destination: 'medication-taken', type: 'MEDICATION_TAKEN' },
  { destination: 'medication-stopped', type: 'MEDICATION_STOPPED' },
  { destination: 'anomaly-detected', type: 'ANOMALY_DETECTED' },
  { destination: 'camera-analysis', type: 'CAMERA_ANALYSIS' },
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
      sosEventId?: number | string;
      title?: string;
      type?: ConnectionRealtimeType;
      wardId?: string;
      wardName?: string;
      medicationId?: number | string;
      medicationName?: string;
      doseDate?: string;
      taken?: boolean | string;
      takenAt?: string;
      stoppedCount?: number | string;
      location?: string;
      detectedType?: string;
      detectedTypeLabel?: string;
      sessionId?: string;
      anomalyEventId?: number | string;
      incidentId?: number | string;
      detectedAt?: string;
      status?: string | null;
      confidence?: number | string;
      danger?: boolean | string;
      analyzedAt?: string;
    };

    return {
      body: parsed.body ?? parsed.message ?? parsed.notification?.body,
      connectionId: parsed.connectionId === undefined ? undefined : String(parsed.connectionId),
      from: parsed.from,
      sosEventId: parsed.sosEventId === undefined ? undefined : String(parsed.sosEventId),
      title: parsed.title ?? parsed.notification?.title,
      type: parsed.type ?? fallbackType,
      wardId: parsed.wardId,
      wardName: parsed.wardName,
      medicationId: parsed.medicationId === undefined ? undefined : String(parsed.medicationId),
      medicationName: parsed.medicationName,
      doseDate: parsed.doseDate,
      taken: parsed.taken === undefined ? undefined : String(parsed.taken),
      takenAt: parsed.takenAt,
      stoppedCount: parsed.stoppedCount === undefined ? undefined : String(parsed.stoppedCount),
      location: parsed.location,
      detectedType: parsed.detectedType,
      detectedTypeLabel: parsed.detectedTypeLabel,
      sessionId: parsed.sessionId,
      anomalyEventId: parsed.anomalyEventId === undefined ? undefined : String(parsed.anomalyEventId),
      incidentId: parsed.incidentId === undefined ? undefined : String(parsed.incidentId),
      detectedAt: parsed.detectedAt,
      status: parsed.status,
      confidence: parsed.confidence === undefined ? undefined : String(parsed.confidence),
      danger: parsed.danger === undefined ? undefined : String(parsed.danger),
      analyzedAt: parsed.analyzedAt,
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
