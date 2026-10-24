// 실시간 알림 WS - 토큰 갱신이 일시 장애(429·5xx·네트워크)로 실패해도 연결을 포기하지 않고 잠시 뒤 다시 켠다.
// 세션이 거절됐을 때(401·403·404)만 멈춘다 (2026-10-24 로그인 유지 점검 M-1)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clients: [] as Array<{
    config: { beforeConnect: () => Promise<void> };
    activate: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
    brokerURL: string;
  }>,
  refreshAccessToken: vi.fn(),
  accessToken: 'expired-token' as string | null,
}));

vi.mock('@stomp/stompjs', () => ({
  Client: class {
    config: { beforeConnect: () => Promise<void>; brokerURL: string };
    brokerURL: string;
    connected = false;
    activate = vi.fn();
    deactivate = vi.fn(() => Promise.resolve());
    constructor(config: { beforeConnect: () => Promise<void>; brokerURL: string }) {
      this.config = config;
      this.brokerURL = config.brokerURL;
      mocks.clients.push(this as never);
    }
  },
}));
vi.mock('@/lib/api/apiClient', () => ({
  refreshAccessToken: mocks.refreshAccessToken,
  isSessionRejected: (error: { response?: { status?: number } }) =>
    [401, 403, 404].includes(error?.response?.status ?? 0),
}));
vi.mock('@/lib/auth/tokenStore', () => ({ getAccessToken: () => mocks.accessToken }));
// 만료 판단은 갱신 분기로 들어가게 고정한다
vi.mock('@/lib/auth/tokenExpiry', () => ({ isAccessTokenExpired: () => true }));

import { connectConnectionSocket } from './connectionSocket';

const RECONNECT_DELAY_MS = 5000;

function connect() {
  const dispose = connectConnectionSocket({ onMessage: () => {}, role: 'GUARDIAN', userId: 'g1' });
  const client = mocks.clients.at(-1)!;
  return { client, dispose };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  mocks.clients.length = 0;
  mocks.accessToken = 'expired-token';
  mocks.refreshAccessToken.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('connectConnectionSocket 토큰 갱신 실패', () => {
  it('일시 장애(503)면 연결을 잠시 끄고 재연결 주기 뒤 다시 켠다', async () => {
    mocks.refreshAccessToken.mockRejectedValue({ response: { status: 503 } });
    const { client } = connect();
    expect(client.activate).toHaveBeenCalledTimes(1);

    await client.config.beforeConnect();

    expect(client.deactivate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(RECONNECT_DELAY_MS);
    expect(client.activate).toHaveBeenCalledTimes(2);
  });

  it('네트워크 오류(응답 없음)도 일시 장애로 보고 다시 켠다', async () => {
    mocks.refreshAccessToken.mockRejectedValue(new Error('Network Error'));
    const { client } = connect();

    await client.config.beforeConnect();
    vi.advanceTimersByTime(RECONNECT_DELAY_MS);

    expect(client.activate).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 404])('세션 거절(%i)이면 연결을 멈추고 다시 켜지 않는다', async status => {
    mocks.refreshAccessToken.mockRejectedValue({ response: { status } });
    const { client } = connect();

    await client.config.beforeConnect();
    vi.advanceTimersByTime(RECONNECT_DELAY_MS * 3);

    expect(client.deactivate).toHaveBeenCalledTimes(1);
    expect(client.activate).toHaveBeenCalledTimes(1);
  });

  it('다시 켜기 전에 화면이 정리되면(dispose) 다시 켜지 않는다', async () => {
    mocks.refreshAccessToken.mockRejectedValue({ response: { status: 502 } });
    const { client, dispose } = connect();

    await client.config.beforeConnect();
    dispose();
    vi.advanceTimersByTime(RECONNECT_DELAY_MS);

    expect(client.activate).toHaveBeenCalledTimes(1);
  });

  it('일시 장애가 연달아 나도 다시 켜기 예약은 한 번만 걸린다', async () => {
    mocks.refreshAccessToken.mockRejectedValue({ response: { status: 503 } });
    const { client } = connect();

    await client.config.beforeConnect();
    await client.config.beforeConnect();
    vi.advanceTimersByTime(RECONNECT_DELAY_MS);

    expect(client.activate).toHaveBeenCalledTimes(2);
  });

  it('다시 켠 뒤 갱신에 성공하면 새 토큰으로 연결 주소를 바꾼다', async () => {
    mocks.refreshAccessToken.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce('fresh-token');
    const { client } = connect();

    await client.config.beforeConnect();
    vi.advanceTimersByTime(RECONNECT_DELAY_MS);
    await client.config.beforeConnect();

    expect(client.brokerURL).toContain('token=fresh-token');
  });
});
