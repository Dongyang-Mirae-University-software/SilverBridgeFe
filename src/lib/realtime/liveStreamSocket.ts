type SendAction =
  | { action: 'list' }
  | { action: 'subscribe'; sessionId: string }
  | { action: 'unsubscribe'; sessionId: string }
  | { action: 'ping' };

export type LiveStreamServerEvent =
  | { type: 'live_streams'; data: unknown[] }
  | { type: 'session_status'; data: unknown }
  | { type: 'latest_analysis'; data: unknown }
  | { type: 'pong' };

interface LiveStreamSocketOptions {
  wsUrl: string;
  onEvent: (event: LiveStreamServerEvent) => void;
}

interface LiveStreamSocketHandle {
  subscribe: (sessionId: string) => void;
  unsubscribeAll: () => void;
  disconnect: () => void;
}

const PING_INTERVAL_MS = 30_000;

export function connectLiveStreamSocket({ wsUrl, onEvent }: LiveStreamSocketOptions): LiveStreamSocketHandle {
  const ws = new WebSocket(wsUrl);
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let currentSessionId: string | null = null;
  let isDisconnected = false;

  function send(action: SendAction) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(action));
      return true;
    }

    return false;
  }

  function clearPingTimer() {
    if (!pingTimer) return;
    clearInterval(pingTimer);
    pingTimer = null;
  }

  ws.onopen = () => {
    send({ action: 'list' });
    if (currentSessionId) send({ action: 'subscribe', sessionId: currentSessionId });
    clearPingTimer();
    pingTimer = setInterval(() => send({ action: 'ping' }), PING_INTERVAL_MS);
  };

  ws.onmessage = event => {
    try {
      const parsed = JSON.parse(event.data as string) as LiveStreamServerEvent;
      onEvent(parsed);
    } catch {
      // 파싱 실패 메시지 무시
    }
  };

  ws.onclose = () => {
    clearPingTimer();
  };

  return {
    subscribe(sessionId: string) {
      if (isDisconnected) return;
      if (currentSessionId === sessionId) {
        send({ action: 'subscribe', sessionId });
        return;
      }

      if (currentSessionId && currentSessionId !== sessionId) {
        send({ action: 'unsubscribe', sessionId: currentSessionId });
      }
      currentSessionId = sessionId;
      send({ action: 'subscribe', sessionId });
    },
    unsubscribeAll() {
      if (isDisconnected) return;
      if (currentSessionId) {
        send({ action: 'unsubscribe', sessionId: currentSessionId });
        currentSessionId = null;
      }
    },
    disconnect() {
      isDisconnected = true;
      clearPingTimer();
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) ws.close();
    },
  };
}
