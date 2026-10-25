// 토큰 갱신 - 동시 갱신은 한 번만, 세션이 거절될 때(401·403·404)만 세션을 지우고
// 일시 장애(429·5xx·네트워크)로는 로그아웃시키지 않는다. 다른 탭이 이미 갱신했으면 옛 토큰으로 다시 부르지 않는다
// (BE가 refresh 토큰을 회전하고 재사용을 감지해 같은 토큰으로 두 번 부르면 세션이 끊긴다)

import axios, { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expiredAccessToken, installCookieJar, type StoredCookie, validAccessToken } from '@/lib/auth/__testutils__/fakeAuthEnv';

type Handler = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

let handler: Handler;
axios.defaults.adapter = config => handler(config);

const ACCESS = 'careai_access_token';
const REFRESH = 'careai_refresh_token';

let jar: Map<string, StoredCookie>;
let api: typeof import('./apiClient');
let store: typeof import('@/lib/auth/tokenStore');
let refreshCalls: string[];

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown): Promise<AxiosResponse> {
  const response = { config, data, headers: {}, status, statusText: String(status) } as AxiosResponse;
  if (status >= 200 && status < 300) return Promise.resolve(response);
  return Promise.reject(new AxiosError(`status ${status}`, 'ERR_BAD_RESPONSE', config, null, response));
}

function bodyOf(config: InternalAxiosRequestConfig) {
  return typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
}

function refreshSucceeds(accessToken: string, refreshToken: string) {
  return { success: true, code: 200, data: { accessToken, refreshToken } };
}

beforeEach(async () => {
  vi.resetModules();
  jar = installCookieJar();
  refreshCalls = [];
  store = await import('@/lib/auth/tokenStore');
  api = await import('./apiClient');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('동시 401', () => {
  it('여러 요청이 동시에 401이면 갱신은 한 번만 하고 모두 새 토큰으로 다시 보낸다', async () => {
    const newAccess = validAccessToken();
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: true });
    handler = config => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCalls.push(bodyOf(config).refreshToken);
        return respond(config, 200, refreshSucceeds(newAccess, 'r2'));
      }
      const authorization = AxiosHeaders.from(config.headers).get('Authorization');
      return authorization === `Bearer ${newAccess}` ? respond(config, 200, { ok: true }) : respond(config, 401, {});
    };

    const results = await Promise.all([api.apiClient.get('/a'), api.apiClient.get('/b'), api.apiClient.get('/c')]);

    expect(refreshCalls).toEqual(['r1']);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(jar.get(REFRESH)?.value).toBe('r2');
  });
});

describe('갱신 실패 분류', () => {
  it.each([401, 403, 404])('갱신 %i → 세션을 지운다', async status => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: true });
    handler = config => respond(config, status, {});

    const error = await api.refreshAccessToken().catch(reason => reason);

    expect(api.isSessionRejected(error)).toBe(true);
    expect(jar.has(ACCESS)).toBe(false);
    expect(jar.has(REFRESH)).toBe(false);
  });

  it.each([429, 500, 502, 503])('갱신 %i → 세션을 남긴다', async status => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: true });
    handler = config => respond(config, status, {});

    const error = await api.refreshAccessToken().catch(reason => reason);

    expect(api.isSessionRejected(error)).toBe(false);
    expect(jar.get(REFRESH)?.value).toBe('r1');
    expect(store.getRefreshToken()).toBe('r1');
  });

  it('네트워크 오류·시간 초과 → 세션을 남긴다', async () => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: true });
    handler = config => Promise.reject(new AxiosError('timeout', 'ECONNABORTED', config));

    const error = await api.refreshAccessToken().catch(reason => reason);

    expect(api.isSessionRejected(error)).toBe(false);
    expect(jar.get(REFRESH)?.value).toBe('r1');
  });

  it('200인데 토큰이 빠진 응답 → 거절로 보고 세션을 지운다', async () => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: true });
    handler = config => respond(config, 200, { success: true, code: 200, data: { accessToken: validAccessToken(), refreshToken: null } });

    const error = await api.refreshAccessToken().catch(reason => reason);

    expect(error).toBeInstanceOf(api.SessionRejectedError);
    expect(jar.has(REFRESH)).toBe(false);
  });

  it('refresh 토큰이 없으면 거절로 본다', async () => {
    const error = await api.refreshAccessToken().catch(reason => reason);

    expect(error).toBeInstanceOf(api.SessionRejectedError);
  });

  it('갱신 5xx 뒤 원래 요청도 401이면 세션을 남긴 채 실패한다(로그아웃 없음)', async () => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: true });
    handler = config => respond(config, config.url?.includes('/auth/refresh') ? 503 : 401, {});

    await expect(api.apiClient.get('/a')).rejects.toBeDefined();

    expect(jar.get(REFRESH)?.value).toBe('r1');
  });
});

describe('로그인 유지 해제 상태의 갱신', () => {
  it('갱신 후에도 세션 쿠키(max-age 없음)로 남는다', async () => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: false });
    handler = config => respond(config, 200, refreshSucceeds(validAccessToken(), 'r2'));

    await api.refreshAccessToken();

    expect(jar.get(REFRESH)).toEqual({ value: 'r2', maxAge: undefined });
    expect(jar.get(ACCESS)?.maxAge).toBeUndefined();
  });
});

describe('탭 간 직렬화', () => {
  it('Web Locks 가 있으면 같은 이름의 락 안에서 갱신한다', async () => {
    const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    vi.stubGlobal('navigator', { locks: { request } });
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: true });
    handler = config => respond(config, 200, refreshSucceeds(validAccessToken(), 'r2'));

    await api.refreshAccessToken();

    expect(request).toHaveBeenCalledWith('careai-token-refresh', expect.any(Function));
  });

  it('Web Locks 가 없는 브라우저에서도 갱신한다(탭 안 직렬화만)', async () => {
    vi.stubGlobal('navigator', {});
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: true });
    handler = config => {
      refreshCalls.push(bodyOf(config).refreshToken);
      return respond(config, 200, refreshSucceeds(validAccessToken(), 'r2'));
    };

    await Promise.all([api.refreshAccessToken(), api.refreshAccessToken()]);

    expect(refreshCalls).toEqual(['r1']);
    expect(jar.get(REFRESH)?.value).toBe('r2');
  });

  it('락 안에서 갱신이 실패해도 락을 놓고, 다음 갱신은 다시 시도된다', async () => {
    let held = false;
    vi.stubGlobal('navigator', {
      locks: {
        // 실제 Web Locks 처럼 콜백이 끝나면(성공·실패 모두) 락을 놓는다
        request: async (_name: string, task: () => Promise<unknown>) => {
          expect(held).toBe(false);
          held = true;
          try {
            return await task();
          } finally {
            held = false;
          }
        },
      },
    });
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: true });
    handler = config => respond(config, 503, {});

    const error = await api.refreshAccessToken().catch(reason => reason);
    expect(api.isSessionRejected(error)).toBe(false);
    expect(held).toBe(false);

    handler = config => respond(config, 200, refreshSucceeds(validAccessToken(), 'r2'));
    await api.refreshAccessToken();
    expect(jar.get(REFRESH)?.value).toBe('r2');
  });

  it('락을 기다리는 사이 다른 탭이 갱신했으면 BE를 다시 부르지 않고 그 토큰을 쓴다', async () => {
    const otherTabAccess = validAccessToken();
    vi.stubGlobal('navigator', {
      locks: {
        request: async (_name: string, task: () => Promise<unknown>) => {
          // 다른 탭이 먼저 락을 쥐고 r1 → r2 로 회전해 쿠키에 저장했다
          jar.set(ACCESS, { value: otherTabAccess, maxAge: 604800 });
          jar.set(REFRESH, { value: 'r2', maxAge: 604800 });
          return task();
        },
      },
    });
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: true });
    handler = config => {
      refreshCalls.push(bodyOf(config).refreshToken);
      return respond(config, 200, refreshSucceeds(validAccessToken(), 'r3'));
    };

    await expect(api.refreshAccessToken()).resolves.toBe(otherTabAccess);
    expect(refreshCalls).toEqual([]);
    expect(store.getRefreshToken()).toBe('r2');
  });

  it('다른 탭의 access 토큰도 만료됐으면 최신 refresh 토큰으로 갱신한다(옛 토큰 재사용 없음)', async () => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), refreshToken: 'r1', remember: true });
    jar.set(ACCESS, { value: expiredAccessToken(), maxAge: 604800 });
    jar.set(REFRESH, { value: 'r2', maxAge: 604800 });
    handler = config => {
      refreshCalls.push(bodyOf(config).refreshToken);
      return respond(config, 200, refreshSucceeds(validAccessToken(), 'r3'));
    };

    await api.refreshAccessToken();

    expect(refreshCalls).toEqual(['r2']);
  });
});
