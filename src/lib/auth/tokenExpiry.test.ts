import { describe, expect, it } from 'vitest';

import { getAccessTokenExpiryMs, isAccessTokenExpired } from './tokenExpiry';

const NOW = 1_800_000_000_000;

function makeToken(payload: Record<string, unknown>) {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

describe('getAccessTokenExpiryMs', () => {
  it('exp(초)를 밀리초로 돌려준다', () => {
    expect(getAccessTokenExpiryMs(makeToken({ exp: 1_800_000_600 }))).toBe(1_800_000_600_000);
  });
  it('exp가 없거나 숫자가 아니거나 형식이 틀리면 null', () => {
    expect(getAccessTokenExpiryMs(makeToken({ sub: 'a' }))).toBeNull();
    expect(getAccessTokenExpiryMs(makeToken({ exp: 'soon' }))).toBeNull();
    expect(getAccessTokenExpiryMs('not-a-jwt')).toBeNull();
    expect(getAccessTokenExpiryMs('a.@@@.c')).toBeNull();
  });
});

describe('isAccessTokenExpired', () => {
  it('만료된 토큰은 true', () => {
    expect(isAccessTokenExpired(makeToken({ exp: NOW / 1000 - 60 }), NOW)).toBe(true);
  });
  it('30초 안에 만료되면 true, 그보다 여유 있으면 false', () => {
    expect(isAccessTokenExpired(makeToken({ exp: NOW / 1000 + 29 }), NOW)).toBe(true);
    expect(isAccessTokenExpired(makeToken({ exp: NOW / 1000 + 31 }), NOW)).toBe(false);
  });
  it('읽을 수 없는 토큰은 만료로 본다', () => {
    expect(isAccessTokenExpired('garbage', NOW)).toBe(true);
  });
});
