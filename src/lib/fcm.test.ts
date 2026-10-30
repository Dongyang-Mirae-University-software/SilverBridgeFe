import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteToken, getTokenMock, registerToken } = vi.hoisted(() => ({
  deleteToken: vi.fn(),
  getTokenMock: vi.fn(),
  registerToken: vi.fn(),
}));

vi.mock('firebase/app', () => ({ getApps: () => [{}], initializeApp: vi.fn() }));
vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  getToken: getTokenMock,
  isSupported: vi.fn(async () => true),
  onMessage: vi.fn(),
}));
vi.mock('@/lib/api/reportError', () => ({ reportNonApiError: vi.fn() }));
vi.mock('@/lib/auth/tokenStore', () => ({ getAccessTokenSubject: () => 'user-1' }));
vi.mock('@/service/api/user/notification', () => ({
  deleteNotificationFcmToken: deleteToken,
  registerNotificationFcmToken: registerToken,
}));

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

let local: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  vi.resetModules();
  deleteToken.mockReset().mockResolvedValue(undefined);
  registerToken.mockReset().mockResolvedValue(undefined);
  getTokenMock.mockReset();
  local = memoryStorage();
  // 탭을 새로 연 상황 - sessionStorage는 비어 있고 localStorage만 남아 있다
  vi.stubGlobal('window', { localStorage: local, sessionStorage: memoryStorage(), Notification: {} });
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission: async () => 'granted' });
  vi.stubGlobal('navigator', { serviceWorker: { register: async () => ({}), ready: Promise.resolve({}) } });
});

async function unregister() {
  const { unregisterFcmTokenForCurrentDevice } = await import('./fcm');
  return unregisterFcmTokenForCurrentDevice();
}

async function register() {
  const { registerFcmTokenForCurrentDevice } = await import('./fcm');
  return registerFcmTokenForCurrentDevice();
}

describe('FCM 토큰 교체', () => {
  it('토큰이 바뀌면 새 토큰을 등록한 뒤 옛 토큰을 지운다', async () => {
    local.setItem('careai_fcm_last_token', 'old-token');
    getTokenMock.mockResolvedValue('new-token');

    await expect(register()).resolves.toBe('new-token');

    expect(registerToken).toHaveBeenCalledWith({ token: 'new-token', platform: 'WEB' });
    expect(deleteToken).toHaveBeenCalledWith('old-token');
    expect(registerToken.mock.invocationCallOrder[0]).toBeLessThan(deleteToken.mock.invocationCallOrder[0]);
    expect(local.getItem('careai_fcm_last_token')).toBe('new-token');
  });

  it('같은 토큰이면 지우지 않는다', async () => {
    local.setItem('careai_fcm_last_token', 'same-token');
    getTokenMock.mockResolvedValue('same-token');

    await register();

    expect(deleteToken).not.toHaveBeenCalled();
  });

  it('옛 토큰 삭제가 실패해도 등록은 성공한다', async () => {
    local.setItem('careai_fcm_last_token', 'old-token');
    getTokenMock.mockResolvedValue('new-token');
    deleteToken.mockRejectedValue(new Error('network'));

    await expect(register()).resolves.toBe('new-token');
    expect(local.getItem('careai_fcm_last_token')).toBe('new-token');
  });
});

describe('로그아웃 토큰 해제', () => {
  it('서버에서 지우면 기억한 토큰도 잊는다', async () => {
    local.setItem('careai_fcm_last_token', 'token-1');
    getTokenMock.mockResolvedValue('token-1');

    await unregister();

    expect(deleteToken).toHaveBeenCalledWith('token-1');
    expect(local.getItem('careai_fcm_last_token')).toBeNull();
  });

  it('서버 삭제가 실패하면 기억을 남겨 다음 등록 때 다시 지운다', async () => {
    local.setItem('careai_fcm_last_token', 'token-1');
    getTokenMock.mockResolvedValue('token-1');
    deleteToken.mockRejectedValueOnce(new Error('network'));

    await expect(unregister()).rejects.toThrow('network');
    expect(local.getItem('careai_fcm_last_token')).toBe('token-1');

    getTokenMock.mockResolvedValue('token-2');
    await register();
    expect(deleteToken).toHaveBeenLastCalledWith('token-1');
  });
});
