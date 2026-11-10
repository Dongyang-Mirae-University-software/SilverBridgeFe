// 토큰 갱신 - 동시 갱신은 한 번만, 세션이 거절될 때(401·403·404)만 세션을 지우고
// 일시 장애(429·5xx·네트워크)로는 로그아웃시키지 않는다. 다른 탭이 이미 갱신했으면 다시 부르지 않는다
// (BE가 refresh 토큰을 회전하고 재사용을 감지해 같은 토큰으로 두 번 부르면 세션이 끊긴다).
// refresh 토큰은 HttpOnly 쿠키로만 오간다 - 화면은 본문에 싣지 않고 응답 본문 값도 저장하지 않는다(2026-11-10 전체 점검 S-1)

import axios, { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expiredAccessToken, installCookieJar, type StoredCookie, validAccessToken } from '@/lib/auth/__testutils__/fakeAuthEnv';

type Handler = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

let handler: Handler;
axios.defaults.adapter = config => handler(config);

const ACCESS = 'careai_access_token';
const SESSION = 'careai_session';
const LEGACY_REFRESH = 'careai_refresh_token';
const TRACE = 'careai_session_trace';

let jar: Map<string, StoredCookie>;
let api: typeof import('./apiClient');
let store: typeof import('@/lib/auth/tokenStore');
// 갱신 요청마다 본문을 기록한다(본문 없이 보내야 한다 - undefined)
let refreshCalls: unknown[];

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown): Promise<AxiosResponse> {
  const response = { config, data, headers: {}, status, statusText: String(status) } as AxiosResponse;
  if (status >= 200 && status < 300) return Promise.resolve(response);
  return Promise.reject(new AxiosError(`status ${status}`, 'ERR_BAD_RESPONSE', config, null, response));
}

function bodyOf(config: InternalAxiosRequestConfig) {
  return typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
}

// 전환 기간에는 백엔드가 본문에도 refreshToken 을 싣는다(나중에는 null) - 어느 쪽이든 화면은 쓰지 않는다
function refreshSucceeds(accessToken: string, refreshToken: string | null = 'r-body') {
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
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    handler = config => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCalls.push(bodyOf(config));
        return respond(config, 200, refreshSucceeds(newAccess));
      }
      const authorization = AxiosHeaders.from(config.headers).get('Authorization');
      return authorization === `Bearer ${newAccess}` ? respond(config, 200, { ok: true }) : respond(config, 401, {});
    };

    const results = await Promise.all([api.apiClient.get('/a'), api.apiClient.get('/b'), api.apiClient.get('/c')]);

    expect(refreshCalls).toEqual([undefined]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(jar.get(ACCESS)?.value).toBe(newAccess);
  });
});

describe('refresh 토큰을 화면이 다루지 않는다', () => {
  it('갱신 요청에 본문·Authorization 을 싣지 않고, 응답 본문의 refresh 토큰을 어디에도 저장하지 않는다', async () => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    let authorization: unknown = 'unset';
    handler = config => {
      refreshCalls.push(bodyOf(config));
      authorization = AxiosHeaders.from(config.headers).get('Authorization');
      return respond(config, 200, refreshSucceeds(validAccessToken(), 'r-secret'));
    };

    await api.refreshAccessToken();

    expect(refreshCalls).toEqual([undefined]);
    expect(authorization).toBeFalsy();
    expect(jar.has(LEGACY_REFRESH)).toBe(false);
    expect([...jar.values()].some(cookie => cookie.value.includes('r-secret'))).toBe(false);
  });

  it('백엔드가 본문 refreshToken 을 null 로 내려도(전환 종료 뒤) 갱신된다', async () => {
    const newAccess = validAccessToken();
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    handler = config => respond(config, 200, refreshSucceeds(newAccess, null));

    await expect(api.refreshAccessToken()).resolves.toBe(newAccess);
    expect(store.hasSession()).toBe(true);
  });

  it('예전 버전이 남긴 refresh 쿠키만 있어도 갱신하고, 그 쿠키는 지운다', async () => {
    const newAccess = validAccessToken();
    jar.set(LEGACY_REFRESH, { value: 'r-old', maxAge: 604800 });
    handler = config => {
      refreshCalls.push(bodyOf(config));
      return respond(config, 200, refreshSucceeds(newAccess));
    };

    await expect(api.refreshAccessToken()).resolves.toBe(newAccess);
    expect(refreshCalls).toEqual([undefined]);
    expect(jar.has(LEGACY_REFRESH)).toBe(false);
    expect(jar.get(SESSION)?.value).toBe('1');
  });
});

describe('갱신 실패 분류', () => {
  it.each([401, 403, 404])('갱신 %i → 세션을 지운다', async status => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    handler = config => respond(config, status, {});

    const error = await api.refreshAccessToken().catch(reason => reason);

    expect(api.isSessionRejected(error)).toBe(true);
    expect(jar.has(ACCESS)).toBe(false);
    expect(jar.has(SESSION)).toBe(false);
  });

  it.each([429, 500, 502, 503])('갱신 %i → 세션을 남긴다', async status => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    handler = config => respond(config, status, {});

    const error = await api.refreshAccessToken().catch(reason => reason);

    expect(api.isSessionRejected(error)).toBe(false);
    expect(store.hasSession()).toBe(true);
  });

  it('네트워크 오류·시간 초과 → 세션을 남긴다', async () => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    handler = config => Promise.reject(new AxiosError('timeout', 'ECONNABORTED', config));

    const error = await api.refreshAccessToken().catch(reason => reason);

    expect(api.isSessionRejected(error)).toBe(false);
    expect(store.hasSession()).toBe(true);
  });

  it('200인데 access 토큰이 빠진 응답 → 거절로 보고 세션을 지운다', async () => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    handler = config => respond(config, 200, { success: true, code: 200, data: { accessToken: null, refreshToken: 'r2' } });

    const error = await api.refreshAccessToken().catch(reason => reason);

    expect(error).toBeInstanceOf(api.SessionRejectedError);
    expect(jar.has(SESSION)).toBe(false);
  });

  it('로그인 세션 표시가 없으면 서버를 부르지 않고 거절로 본다', async () => {
    handler = config => {
      refreshCalls.push(bodyOf(config));
      return respond(config, 200, refreshSucceeds(validAccessToken()));
    };

    const error = await api.refreshAccessToken().catch(reason => reason);

    expect(error).toBeInstanceOf(api.SessionRejectedError);
    expect(refreshCalls).toEqual([]);
  });

  it('갱신 5xx 뒤 원래 요청도 401이면 세션을 남긴 채 실패한다(로그아웃 없음)', async () => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    handler = config => respond(config, config.url?.includes('/auth/refresh') ? 503 : 401, {});

    await expect(api.apiClient.get('/a')).rejects.toBeDefined();

    expect(store.hasSession()).toBe(true);
  });
});

describe('로그인 유지 해제 상태의 갱신', () => {
  it('갱신 후에도 세션 쿠키(max-age 없음)로 남는다', async () => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: false });
    handler = config => respond(config, 200, refreshSucceeds(validAccessToken()));

    await api.refreshAccessToken();

    expect(jar.get(SESSION)).toEqual({ value: '1', maxAge: undefined });
    expect(jar.get(ACCESS)?.maxAge).toBeUndefined();
  });
});

describe('탭 간 직렬화', () => {
  it('Web Locks 가 있으면 같은 이름의 락 안에서 갱신한다', async () => {
    const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    vi.stubGlobal('navigator', { locks: { request } });
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    handler = config => respond(config, 200, refreshSucceeds(validAccessToken()));

    await api.refreshAccessToken();

    expect(request).toHaveBeenCalledWith('careai-token-refresh', expect.any(Function));
  });

  it('Web Locks 가 없는 브라우저에서도 갱신한다(탭 안 직렬화만)', async () => {
    vi.stubGlobal('navigator', {});
    const newAccess = validAccessToken();
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    handler = config => {
      refreshCalls.push(bodyOf(config));
      return respond(config, 200, refreshSucceeds(newAccess));
    };

    await Promise.all([api.refreshAccessToken(), api.refreshAccessToken()]);

    expect(refreshCalls).toHaveLength(1);
    expect(jar.get(ACCESS)?.value).toBe(newAccess);
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
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    handler = config => respond(config, 503, {});

    const error = await api.refreshAccessToken().catch(reason => reason);
    expect(api.isSessionRejected(error)).toBe(false);
    expect(held).toBe(false);

    const newAccess = validAccessToken();
    handler = config => respond(config, 200, refreshSucceeds(newAccess));
    await api.refreshAccessToken();
    expect(jar.get(ACCESS)?.value).toBe(newAccess);
  });

  it('락을 기다리는 사이 다른 탭이 갱신했으면 BE를 다시 부르지 않고 그 토큰을 쓴다', async () => {
    const otherTabAccess = validAccessToken('WARD');
    vi.stubGlobal('navigator', {
      locks: {
        request: async (_name: string, task: () => Promise<unknown>) => {
          // 다른 탭이 먼저 락을 쥐고 갱신해 새 access 토큰을 쿠키에 저장했다(refresh 쿠키는 브라우저가 함께 바꿨다)
          jar.set(ACCESS, { value: otherTabAccess, maxAge: 1800 });
          return task();
        },
      },
    });
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    handler = config => {
      refreshCalls.push(bodyOf(config));
      return respond(config, 200, refreshSucceeds(validAccessToken()));
    };

    await expect(api.refreshAccessToken()).resolves.toBe(otherTabAccess);
    expect(refreshCalls).toEqual([]);
  });

  it('다른 탭의 access 토큰도 만료됐으면 다시 갱신한다', async () => {
    store.setAuthTokens({ accessToken: expiredAccessToken(), remember: true });
    jar.set(ACCESS, { value: expiredAccessToken('WARD'), maxAge: 1800 });
    handler = config => {
      refreshCalls.push(bodyOf(config));
      return respond(config, 200, refreshSucceeds(validAccessToken()));
    };

    await api.refreshAccessToken();

    expect(refreshCalls).toHaveLength(1);
  });

  it('살아 있는 토큰으로 401을 받았으면(서버가 무효화) 쿠키 값이 같으므로 갱신한다', async () => {
    const current = validAccessToken();
    const newAccess = validAccessToken('WARD');
    store.setAuthTokens({ accessToken: current, remember: true });
    handler = config => {
      refreshCalls.push(bodyOf(config));
      return respond(config, 200, refreshSucceeds(newAccess));
    };

    await expect(api.refreshAccessToken()).resolves.toBe(newAccess);
    expect(refreshCalls).toHaveLength(1);
  });
});

describe('로그인 유지를 끈 로그인 뒤 남은 세션 끝내기', () => {
  function leaveTraceOnly() {
    store.setAuthTokens({ accessToken: validAccessToken(), remember: false });
    for (const name of [ACCESS, SESSION, 'careai_session_only']) jar.delete(name);
    store.reloadAuthTokensFromStorage();
  }

  it('흔적만 남았으면 갱신으로 받은 토큰으로 곧바로 로그아웃하고 흔적을 지운다', async () => {
    leaveTraceOnly();
    const leftover = validAccessToken();
    const calls: string[] = [];
    handler = config => {
      calls.push(`${config.url} ${AxiosHeaders.from(config.headers).get('Authorization') ?? ''}`.trim());
      return config.url?.includes('/auth/refresh') ? respond(config, 200, refreshSucceeds(leftover)) : respond(config, 200, {});
    };

    await api.endLeftoverSession();

    expect(calls).toEqual(['/auth/refresh', `/auth/logout Bearer ${leftover}`]);
    expect(jar.has(TRACE)).toBe(false);
    // 받은 토큰으로 로그인 상태가 되지 않는다
    expect(jar.has(ACCESS)).toBe(false);
    expect(store.hasSession()).toBe(false);
  });

  it('남은 세션이 없으면(401) 흔적만 지운다', async () => {
    leaveTraceOnly();
    handler = config => respond(config, 401, {});

    await api.endLeftoverSession();

    expect(jar.has(TRACE)).toBe(false);
  });

  it('일시 장애면 흔적을 남겨 다음에 다시 시도한다', async () => {
    leaveTraceOnly();
    handler = config => respond(config, 503, {});

    await api.endLeftoverSession();

    expect(jar.has(TRACE)).toBe(true);
  });

  it('로그인해 있거나 흔적이 없으면 서버를 부르지 않는다', async () => {
    const calls: string[] = [];
    handler = config => {
      calls.push(String(config.url));
      return respond(config, 200, {});
    };

    await api.endLeftoverSession();
    store.setAuthTokens({ accessToken: validAccessToken(), remember: false });
    await api.endLeftoverSession();

    expect(calls).toEqual([]);
  });
});
