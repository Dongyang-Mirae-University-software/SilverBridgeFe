import { describe, expect, it } from 'vitest';

import { buildKakaoState, isKakaoStateTrusted, parseKakaoState } from './kakaoState';

const NONCE = '0123456789abcdef0123456789abcdef';

describe('카카오 로그인 state (2026-11-10 전체 점검 S-5)', () => {
  it('난수와 돌아갈 경로를 함께 싣고 다시 읽는다', () => {
    const state = buildKakaoState(NONCE, '/guardian/wards/register?code=1');
    expect(parseKakaoState(state)).toEqual({ nonce: NONCE, returnTo: '/guardian/wards/register?code=1' });
    expect(parseKakaoState(buildKakaoState(NONCE, null))).toEqual({ nonce: NONCE, returnTo: null });
  });

  it('돌아갈 경로가 다른 출처면 버린다', () => {
    expect(parseKakaoState(`${NONCE}:https://evil.example/x`)?.returnTo).toBeNull();
    expect(parseKakaoState(`${NONCE}://evil.example`)?.returnTo).toBeNull();
  });

  it('쿠키의 난수와 같을 때만 믿는다', () => {
    expect(isKakaoStateTrusted(buildKakaoState(NONCE, '/guardian'), NONCE)).toBe(true);
    expect(isKakaoStateTrusted(buildKakaoState(NONCE, '/guardian'), 'f'.repeat(32))).toBe(false);
    expect(isKakaoStateTrusted(buildKakaoState(NONCE, null), null)).toBe(false);
  });

  it('난수가 없는 옛 형식(경로만)·빈 값은 믿지 않는다', () => {
    expect(isKakaoStateTrusted('/guardian', NONCE)).toBe(false);
    expect(isKakaoStateTrusted(null, NONCE)).toBe(false);
    expect(parseKakaoState('짧은값')).toBeNull();
  });
});
