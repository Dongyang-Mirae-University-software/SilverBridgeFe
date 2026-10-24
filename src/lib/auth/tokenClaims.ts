// access token(JWT) payload 를 서명 검증 없이 읽는 단 한 곳. 화면 이동·갱신 시점·구독 대상 판단용이며
// 유효성 판단은 서버가 한다. 형식이 이상하면 null.
export function decodeAccessTokenClaims(token?: string | null): Record<string, unknown> | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const claims: unknown = JSON.parse(atob(padded));
    return typeof claims === 'object' && claims !== null ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
