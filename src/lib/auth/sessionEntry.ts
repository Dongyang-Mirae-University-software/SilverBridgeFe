import type { AuthRole } from '@/lib/auth/tokenStore';
import { getRoleHomePath } from '@/utils/auth/routes';

// 첫 진입(/)에서 어디로 보낼지. access 토큰(30분)이 만료돼도 refresh 토큰(7일)이 있으면
// 로그인 화면이 아니라 브라우저에서 먼저 갱신한다('restore').
// 서버에서 직접 갱신하지 않는 이유: 탭 간 직렬화·회전 토큰 저장이 브라우저 refreshAccessToken 한 곳에 있다
export type EntryDecision = { kind: 'redirect'; path: string } | { kind: 'restore' };

export function resolveEntry(accessToken?: string, refreshToken?: string, now = Date.now()): EntryDecision {
  const role = getRoleFromAccessToken(accessToken, now);
  if (role) return { kind: 'redirect', path: getRoleHomePath(role) };
  if (refreshToken) return { kind: 'restore' };

  return { kind: 'redirect', path: '/login' };
}

// 서명은 검증하지 않는다(화면 이동용). 만료됐거나 읽을 수 없으면 null
export function getRoleFromAccessToken(token?: string, now = Date.now()): AuthRole | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
    const decodedPayload = JSON.parse(atob(paddedPayload)) as { exp?: unknown; role?: unknown };

    if (typeof decodedPayload.exp === 'number' && decodedPayload.exp * 1000 <= now) return null;
    if (decodedPayload.role === 'WARD' || decodedPayload.role === 'GUARDIAN' || decodedPayload.role === 'ADMIN') return decodedPayload.role;
  } catch {
    return null;
  }

  return null;
}
