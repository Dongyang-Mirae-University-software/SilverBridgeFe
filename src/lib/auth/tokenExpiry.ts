import { decodeAccessTokenClaims } from './tokenClaims';

// access token(JWT)의 만료 시각(exp, 초)을 서명 검증 없이 읽는다. 갱신 시점을 정하는 용도로만 쓴다
// (유효성 판단은 서버가 한다). 형식이 이상하면 null.
export function getAccessTokenExpiryMs(token: string): number | null {
  const exp = decodeAccessTokenClaims(token)?.exp;
  return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
}

// 만료됐거나 skew 안에 만료되는 토큰, 읽을 수 없는 토큰은 '만료'로 본다(쓰기 전에 갱신하는 쪽이 안전하다)
export function isAccessTokenExpired(token: string, now = Date.now(), skewMs = 30_000): boolean {
  const expiresAt = getAccessTokenExpiryMs(token);
  return expiresAt === null || expiresAt - skewMs <= now;
}
