import { createHash } from 'node:crypto';

// 송출 프록시의 "로그인한 피보호자인가" 확인 결과.
// 401은 토큰이 정말 유효하지 않을 때만 쓰고, 백엔드가 429·5xx로 답한 것을 401로 바꾸지 않는다.
export type WardAuthResult =
  | { status: 'ok' }
  | { status: 'unauthorized' }
  | { status: 'forbidden' }
  | { status: 'rate_limited'; retryAfter: string | null }
  | { status: 'unavailable' };

type FetchLike = (url: string, init: { cache: 'no-store'; headers: Record<string, string> }) => Promise<Response>;

export const WARD_AUTH_TTL_MS = 30 * 1000;
export const WARD_AUTH_MAX_ENTRIES = 500;

export function createWardAuthVerifier(options: {
  apiDomain: string;
  fetcher?: FetchLike;
  now?: () => number;
  ttlMs?: number;
  maxEntries?: number;
}) {
  const fetcher: FetchLike = options.fetcher ?? ((url, init) => fetch(url, init));
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? WARD_AUTH_TTL_MS;
  const maxEntries = options.maxEntries ?? WARD_AUTH_MAX_ENTRIES;

  // 키는 토큰의 해시 - 토큰 원문은 메모리 캐시에도 두지 않는다. 성공한 결과만 담는다.
  const valid = new Map<string, number>();
  const inFlight = new Map<string, Promise<WardAuthResult>>();

  function sweep(at: number) {
    for (const [key, expiresAt] of valid) {
      if (expiresAt <= at) valid.delete(key);
    }
    // 만료 청소 뒤에도 가득 차면 가장 오래된 항목부터 버린다(Map은 삽입 순서 유지)
    while (valid.size >= maxEntries) {
      const oldest = valid.keys().next().value;
      if (oldest === undefined) break;
      valid.delete(oldest);
    }
  }

  async function check(accessToken: string): Promise<WardAuthResult> {
    try {
      const response = await fetcher(`${options.apiDomain.replace(/\/$/, '')}/api/user/me`, {
        cache: 'no-store',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 429) return { status: 'rate_limited', retryAfter: response.headers.get('retry-after') };
      if (response.status === 401 || response.status === 403) return { status: 'unauthorized' };
      if (!response.ok) return { status: 'unavailable' };

      const body = (await response.json()) as { data?: { data?: { role?: string }; role?: string } };
      const role = body?.data?.data?.role ?? body?.data?.role;
      return role === 'WARD' ? { status: 'ok' } : { status: 'forbidden' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  return async function verify(accessToken: string): Promise<WardAuthResult> {
    const key = createHash('sha256').update(accessToken).digest('hex');
    const at = now();

    const expiresAt = valid.get(key);
    if (expiresAt !== undefined) {
      if (expiresAt > at) return { status: 'ok' };
      valid.delete(key);
    }

    const pending = inFlight.get(key);
    if (pending) return pending;

    const request = check(accessToken)
      .then(result => {
        if (result.status === 'ok') {
          sweep(now());
          valid.set(key, now() + ttlMs);
        }
        return result;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
    return request;
  };
}
