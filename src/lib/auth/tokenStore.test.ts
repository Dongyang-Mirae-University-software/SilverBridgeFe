// 화면이 두는 쿠키는 access 토큰(토큰 수명만큼)과 로그인 세션 표시뿐이다. refresh 토큰은 백엔드의 HttpOnly 쿠키로만
// 오가므로 화면은 저장하지 않는다(2026-11-10 전체 점검 S-1).
// "로그인 유지" 체크박스가 쿠키 수명을 정한다 - 체크=세션 표시 7일, 해제=세션 쿠키(브라우저를 닫으면 로그아웃).
// 갱신·읽기로 쿠키를 다시 쓸 때도 처음 고른 방식을 유지해야 한다

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeJwt, installCookieJar, type StoredCookie, validAccessToken } from './__testutils__/fakeAuthEnv';

const ACCESS = 'careai_access_token';
const SESSION = 'careai_session';
const LEGACY_REFRESH = 'careai_refresh_token';
const SESSION_ONLY = 'careai_session_only';
const TRACE = 'careai_session_trace';
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
  it('access 쿠키는 토큰 수명만큼, 세션 표시는 7일로 두고 refresh 토큰은 저장하지 않는다', () => {
    const access = validAccessToken();
    store.setAuthTokens({ accessToken: access, remember: true });

    expect(jar.get(ACCESS)?.value).toBe(access);
    expect(jar.get(ACCESS)?.maxAge).toBeGreaterThan(1700);
    expect(jar.get(ACCESS)?.maxAge).toBeLessThanOrEqual(1800);
    expect(jar.get(SESSION)).toEqual({ value: '1', maxAge: SEVEN_DAYS });
    // 알림을 눌렀을 때 열 화면을 고르는 역할 표시(access 쿠키가 사라진 뒤에도 남는다)
    expect(jar.get('careai_role')).toEqual({ value: 'GUARDIAN', maxAge: SEVEN_DAYS });
    expect(jar.has(LEGACY_REFRESH)).toBe(false);
    expect(jar.has(SESSION_ONLY)).toBe(false);
    expect(jar.has(TRACE)).toBe(false);
    expect(store.hasSession()).toBe(true);
  });

  it('만료 시각을 읽을 수 없는 토큰은 30분짜리 쿠키로 둔다', () => {
    store.setAuthTokens({ accessToken: 'not-a-jwt', remember: true });

    expect(jar.get(ACCESS)).toEqual({ value: 'not-a-jwt', maxAge: 1800 });
  });
});

describe('로그인 유지 해제', () => {
  it('access·세션 표시를 max-age 없는 세션 쿠키로 두고, 7일짜리 흔적을 남긴다', () => {
    store.setAuthTokens({ accessToken: 'a1', remember: false });

    expect(jar.get(ACCESS)).toEqual({ value: 'a1', maxAge: undefined });
    expect(jar.get(SESSION)).toEqual({ value: '1', maxAge: undefined });
    expect(jar.get(SESSION_ONLY)).toEqual({ value: '1', maxAge: undefined });
    expect(jar.get(TRACE)).toEqual({ value: '1', maxAge: SEVEN_DAYS });
  });

  it('갱신(remember 생략)해도 세션 쿠키를 유지한다', () => {
    store.setAuthTokens({ accessToken: 'a1', remember: false });
    store.setAuthTokens({ accessToken: 'a2' });

    expect(jar.get(ACCESS)).toEqual({ value: 'a2', maxAge: undefined });
    expect(jar.get(SESSION)?.maxAge).toBeUndefined();
  });

  it('브라우저를 닫았다 열면(세션 쿠키가 사라지면) 흔적만 남아 남은 세션을 끝낼 차례가 된다', async () => {
    store.setAuthTokens({ accessToken: 'a1', remember: false });
    for (const name of [ACCESS, SESSION, SESSION_ONLY]) jar.delete(name);
    vi.resetModules();
    const reopened = await import('./tokenStore');

    expect(reopened.hasSession()).toBe(false);
    expect(reopened.hasLeftoverSessionTrace()).toBe(true);

    reopened.clearLeftoverSessionTrace();
    expect(reopened.hasLeftoverSessionTrace()).toBe(false);
  });

  it('로그인해 있는 동안에는 남은 세션으로 보지 않는다', () => {
    store.setAuthTokens({ accessToken: 'a1', remember: false });

    expect(store.hasLeftoverSessionTrace()).toBe(false);
  });

  it('다음 로그인에서 유지를 체크하면(카카오·가입 완료 포함) 7일로 돌아가고 흔적을 지운다', () => {
    store.setAuthTokens({ accessToken: 'a1', remember: false });
    store.setAuthTokens({ accessToken: 'a2', remember: true });

    expect(jar.get(SESSION)?.maxAge).toBe(SEVEN_DAYS);
    expect(jar.has(SESSION_ONLY)).toBe(false);
    expect(jar.has(TRACE)).toBe(false);
  });

  it('로그아웃(clearAuthTokens)은 화면이 둔 쿠키를 모두 지운다', () => {
    store.setAuthTokens({ accessToken: 'a1', remember: false });
    store.clearAuthTokens();

    expect(jar.size).toBe(0);
  });
});

describe('예전 버전이 남긴 refresh 토큰 쿠키', () => {
  it('보이면 지우고 세션 표시를 달아 로그인을 유지한다', () => {
    jar.set(LEGACY_REFRESH, { value: 'r-old', maxAge: SEVEN_DAYS });

    expect(store.hasSession()).toBe(true);
    expect(jar.has(LEGACY_REFRESH)).toBe(false);
    expect(jar.get(SESSION)).toEqual({ value: '1', maxAge: SEVEN_DAYS });
  });

  it('로그인 유지를 끈 세션이었으면 세션 표시도 세션 쿠키로 단다', () => {
    jar.set(LEGACY_REFRESH, { value: 'r-old', maxAge: undefined });
    jar.set(SESSION_ONLY, { value: '1', maxAge: undefined });

    expect(store.hasSession()).toBe(true);
    expect(jar.get(SESSION)).toEqual({ value: '1', maxAge: undefined });
  });

  it('없으면 세션도 없다', () => {
    expect(store.hasSession()).toBe(false);
    expect(jar.size).toBe(0);
  });
});

describe('completeSigninSession', () => {
  it('remember 를 넘기지 않으면(카카오·회원가입 완료) 유지로 본다', async () => {
    vi.doMock('@/lib/fcm', () => ({ registerFcmTokenForCurrentDevice: () => Promise.resolve() }));
    store.setAuthTokens({ accessToken: 'a0', remember: false });
    const { completeSigninSession } = await import('./completeSignin');

    completeSigninSession({ accessToken: 'a1' });

    expect(jar.get(SESSION)?.maxAge).toBe(SEVEN_DAYS);
    expect(jar.has(SESSION_ONLY)).toBe(false);
  });
});

describe('챗봇 대화 탭 저장소 정리 (2026-11-11)', () => {
  function stubSessionStorage() {
    const map = new Map<string, string>();
    const storage = {
      get length() {
        return map.size;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    };
    vi.stubGlobal('window', { sessionStorage: storage });
    return map;
  }
  const exp = () => Math.floor(Date.now() / 1000) + 1800;

  it('로그아웃하면 저장한 대화를 모두 지운다', async () => {
    const map = stubSessionStorage();
    const conv = await import('@/store/chatConversationStore');
    const key = conv.conversationKey('GUARDIAN', 'user-a', 'ward-1');
    map.set(key, '{}');

    store.clearAuthTokens();
    expect(map.has(key)).toBe(false);
  });

  it('같은 사람의 토큰 갱신이면 남기고, 다른 계정으로 로그인하면 앞 사람 대화를 지운다', async () => {
    const map = stubSessionStorage();
    const conv = await import('@/store/chatConversationStore');
    const mine = conv.conversationKey('GUARDIAN', 'user-a', 'ward-1');
    map.set(mine, '{}');

    store.setAuthTokens({ accessToken: fakeJwt({ sub: 'user-a', role: 'GUARDIAN', exp: exp() }) });
    expect(map.has(mine)).toBe(true);

    store.setAuthTokens({ accessToken: fakeJwt({ sub: 'user-b', role: 'WARD', exp: exp() }) });
    expect(map.has(mine)).toBe(false);
  });
});
