// access token payload 해석(한 곳) - 형식이 이상하면 null
import { describe, expect, it } from 'vitest';

import { fakeJwt } from './__testutils__/fakeAuthEnv';
import { getAccessTokenExpiryMs } from './tokenExpiry';
import { getRoleFromAccessToken } from './sessionEntry';
import { decodeAccessTokenClaims } from './tokenClaims';

describe('decodeAccessTokenClaims', () => {
  it('base64url payload 를 객체로 읽는다(패딩 없는 길이 포함)', () => {
    expect(decodeAccessTokenClaims(fakeJwt({ role: 'WARD', exp: 1 }))).toEqual({ role: 'WARD', exp: 1 });
    expect(decodeAccessTokenClaims(fakeJwt({ role: 'GUARDIAN', exp: 12345 }))).toEqual({ role: 'GUARDIAN', exp: 12345 });
  });

  it.each([undefined, null, '', 'not-a-jwt', 'a.%%%.c', `a.${Buffer.from('1').toString('base64url')}.c`, `a.${Buffer.from('null').toString('base64url')}.c`])(
    '형식이 이상하면 null (%s)',
    token => {
      expect(decodeAccessTokenClaims(token)).toBeNull();
    },
  );

  it('만료 시각·역할 판단이 같은 해석을 쓴다', () => {
    const token = fakeJwt({ role: 'WARD', exp: 2_000_000_000 });
    expect(getAccessTokenExpiryMs(token)).toBe(2_000_000_000_000);
    expect(getRoleFromAccessToken(token, 0)).toBe('WARD');
    expect(getRoleFromAccessToken(fakeJwt({ role: 'HACKER', exp: 2_000_000_000 }), 0)).toBeNull();
  });
});
