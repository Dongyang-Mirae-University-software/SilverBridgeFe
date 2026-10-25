import { isSessionRejected, refreshAccessToken } from '@/lib/api/apiClient';
import { getRoleHomePath } from '@/utils/auth/routes';
import { getRoleFromAccessToken } from './sessionEntry';

// restored: 새 access 토큰을 받음 / rejected: 세션이 거절돼 이미 지워짐(로그인 화면으로)
// unavailable: 429·5xx·네트워크 같은 일시 장애 - 세션은 그대로 두고 다시 시도하게 한다
export type RestoreResult = { status: 'restored'; homePath: string } | { status: 'rejected' } | { status: 'unavailable' };

export async function restoreSession(): Promise<RestoreResult> {
  try {
    const accessToken = await refreshAccessToken();
    // 역할을 읽지 못하면 보호자 홈으로 보낸다 - 역할이 다르면 RoleRouteGuard 가 프로필 역할의 홈으로 다시 보낸다
    const role = getRoleFromAccessToken(accessToken);
    return { status: 'restored', homePath: getRoleHomePath(role ?? 'GUARDIAN') };
  } catch (error) {
    return isSessionRejected(error) ? { status: 'rejected' } : { status: 'unavailable' };
  }
}

// 보호 화면에서 프로필 조회가 실패했을 때 로그인 화면으로 보낼지.
// 401은 갱신까지 시도한 뒤의 결과다: 세션이 지워졌으면(갱신 거절) 로그인으로, 남아 있으면(갱신 일시 장애) 다시 시도.
// 403(이용 제한 등)·404(없는 회원)는 세션을 끝낸다. 그 밖(429·5xx·네트워크)은 다시 시도
export function shouldEndSessionAfterProfileError(error: unknown, hasRefreshToken: boolean) {
  if (!hasRefreshToken) return true;

  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 403 || status === 404;
}
