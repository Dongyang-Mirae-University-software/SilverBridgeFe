// 첫 진입·보호 화면의 세션 복원 - access 토큰이 만료돼도 refresh 토큰이 있으면 로그인 화면 대신 갱신한다

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expiredAccessToken, installCookieJar, validAccessToken } from './__testutils__/fakeAuthEnv';
import { resolveEntry } from './sessionEntry';

describe('resolveEntry (첫 진입 /)', () => {
  it('유효한 access 토큰 → 역할 홈', () => {
    expect(resolveEntry(validAccessToken('WARD'), 'r1')).toEqual({ kind: 'redirect', path: '/ward' });
    expect(resolveEntry(validAccessToken('GUARDIAN'))).toEqual({ kind: 'redirect', path: '/guardian' });
  });

  it('access 만료 + refresh 있음 → 갱신(restore)', () => {
    expect(resolveEntry(expiredAccessToken(), 'r1')).toEqual({ kind: 'restore' });
  });

  it('access 없음 + refresh 있음 → 갱신(restore)', () => {
    expect(resolveEntry(undefined, 'r1')).toEqual({ kind: 'restore' });
  });

  it('refresh 없음 → /login', () => {
    expect(resolveEntry(expiredAccessToken(), undefined)).toEqual({ kind: 'redirect', path: '/login' });
    expect(resolveEntry(undefined, undefined)).toEqual({ kind: 'redirect', path: '/login' });
  });
});

describe('restoreSession', () => {
  const refreshAccessToken = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    installCookieJar();
    refreshAccessToken.mockReset();
    vi.doMock('@/lib/api/apiClient', async importOriginal => ({
      ...(await importOriginal<typeof import('@/lib/api/apiClient')>()),
      refreshAccessToken,
    }));
  });

  afterEach(() => {
    vi.doUnmock('@/lib/api/apiClient');
    vi.unstubAllGlobals();
  });

  it('갱신 성공 → 새 토큰의 역할 홈', async () => {
    refreshAccessToken.mockResolvedValue(validAccessToken('WARD'));
    const { restoreSession } = await import('./sessionRestore');

    await expect(restoreSession()).resolves.toEqual({ status: 'restored', homePath: '/ward' });
  });

  it('갱신 401 → rejected(로그인 화면)', async () => {
    refreshAccessToken.mockRejectedValue({ response: { status: 401 } });
    const { restoreSession } = await import('./sessionRestore');

    await expect(restoreSession()).resolves.toEqual({ status: 'rejected' });
  });

  it('갱신 5xx → unavailable(세션 유지 + 다시 시도 안내)', async () => {
    refreshAccessToken.mockRejectedValue({ response: { status: 503 } });
    const { restoreSession } = await import('./sessionRestore');

    await expect(restoreSession()).resolves.toEqual({ status: 'unavailable' });
  });
});

describe('shouldEndSessionAfterProfileError (보호 화면 프로필 조회 실패)', () => {
  it('세션이 이미 지워졌으면(갱신 거절) 로그인으로', async () => {
    const { shouldEndSessionAfterProfileError } = await import('./sessionRestore');
    expect(shouldEndSessionAfterProfileError({ response: { status: 401 } }, false)).toBe(true);
  });

  it('403·404 → 로그인으로', async () => {
    const { shouldEndSessionAfterProfileError } = await import('./sessionRestore');
    expect(shouldEndSessionAfterProfileError({ response: { status: 403 } }, true)).toBe(true);
    expect(shouldEndSessionAfterProfileError({ response: { status: 404 } }, true)).toBe(true);
  });

  it('갱신 일시 장애 뒤 401·5xx·네트워크 → 세션 유지(다시 시도)', async () => {
    const { shouldEndSessionAfterProfileError } = await import('./sessionRestore');
    expect(shouldEndSessionAfterProfileError({ response: { status: 401 } }, true)).toBe(false);
    expect(shouldEndSessionAfterProfileError({ response: { status: 500 } }, true)).toBe(false);
    expect(shouldEndSessionAfterProfileError(new Error('Network Error'), true)).toBe(false);
  });
});
