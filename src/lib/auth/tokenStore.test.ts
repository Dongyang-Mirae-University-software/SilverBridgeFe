// "로그인 유지" 체크박스가 토큰 쿠키 수명을 정한다 - 체크=7일, 해제=세션 쿠키(브라우저를 닫으면 로그아웃).
// 갱신·읽기로 쿠키를 다시 쓸 때도 처음 고른 방식을 유지해야 한다

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installCookieJar, type StoredCookie } from './__testutils__/fakeAuthEnv';

const ACCESS = 'careai_access_token';
const REFRESH = 'careai_refresh_token';
const SESSION_ONLY = 'careai_session_only';
const SEVEN_DAYS = 604800;

let jar: Map<string, StoredCookie>;
let store: typeof import('./tokenStore');

beforeEach(async () => {
  vi.resetModules();
  jar = installCookieJar();
  store = await import('./tokenStore');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('로그인 유지 체크', () => {
  it('토큰 쿠키를 7일로 저장하고 세션 표시는 두지 않는다', () => {
    store.setAuthTokens({ accessToken: 'a1', refreshToken: 'r1', remember: true });

    expect(jar.get(ACCESS)).toEqual({ value: 'a1', maxAge: SEVEN_DAYS });
    expect(jar.get(REFRESH)).toEqual({ value: 'r1', maxAge: SEVEN_DAYS });
    expect(jar.has(SESSION_ONLY)).toBe(false);
  });
});

describe('로그인 유지 해제', () => {
  it('토큰 쿠키를 max-age 없는 세션 쿠키로 저장한다', () => {
    store.setAuthTokens({ accessToken: 'a1', refreshToken: 'r1', remember: false });

    expect(jar.get(ACCESS)).toEqual({ value: 'a1', maxAge: undefined });
    expect(jar.get(REFRESH)).toEqual({ value: 'r1', maxAge: undefined });
    expect(jar.get(SESSION_ONLY)).toEqual({ value: '1', maxAge: undefined });
  });

  it('갱신(remember 생략)해도 세션 쿠키를 유지한다', () => {
    store.setAuthTokens({ accessToken: 'a1', refreshToken: 'r1', remember: false });
    store.setAuthTokens({ accessToken: 'a2', refreshToken: 'r2' });

    expect(jar.get(ACCESS)).toEqual({ value: 'a2', maxAge: undefined });
    expect(jar.get(REFRESH)).toEqual({ value: 'r2', maxAge: undefined });
  });

  it('새로고침 뒤 쿠키에서 읽으면서 다시 쓸 때도 7일로 늘리지 않는다', async () => {
    store.setAuthTokens({ accessToken: 'a1', refreshToken: 'r1', remember: false });
    vi.resetModules();
    const reloaded = await import('./tokenStore');

    expect(reloaded.getAccessToken()).toBe('a1');
    expect(reloaded.getRefreshToken()).toBe('r1');
    expect(jar.get(ACCESS)?.maxAge).toBeUndefined();
    expect(jar.get(REFRESH)?.maxAge).toBeUndefined();
  });

  it('다음 로그인에서 유지를 체크하면(카카오·가입 완료 포함) 7일로 돌아간다', () => {
    store.setAuthTokens({ accessToken: 'a1', refreshToken: 'r1', remember: false });
    store.setAuthTokens({ accessToken: 'a2', refreshToken: 'r2', remember: true });

    expect(jar.get(ACCESS)?.maxAge).toBe(SEVEN_DAYS);
    expect(jar.has(SESSION_ONLY)).toBe(false);
  });

  it('로그아웃(clearAuthTokens)은 세션 표시도 지운다', () => {
    store.setAuthTokens({ accessToken: 'a1', refreshToken: 'r1', remember: false });
    store.clearAuthTokens();

    expect(jar.size).toBe(0);
  });
});

describe('completeSigninSession', () => {
  it('remember 를 넘기지 않으면(카카오·회원가입 완료) 유지로 본다', async () => {
    vi.doMock('@/lib/fcm', () => ({ registerFcmTokenForCurrentDevice: () => Promise.resolve() }));
    store.setAuthTokens({ accessToken: 'a0', refreshToken: 'r0', remember: false });
    const { completeSigninSession } = await import('./completeSignin');

    completeSigninSession({ accessToken: 'a1', refreshToken: 'r1' });

    expect(jar.get(ACCESS)?.maxAge).toBe(SEVEN_DAYS);
    expect(jar.has(SESSION_ONLY)).toBe(false);
  });
});
