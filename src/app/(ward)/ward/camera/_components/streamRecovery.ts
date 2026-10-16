// 송출 세션 자동 복구 판정. AI 서버가 재시작되면 세션이 사라져 프레임 업로드가
// 404 STREAM_SESSION_NOT_FOUND 를 받는다 - 이때만 같은 카메라 정보로 세션을 다시 만든다.

export const SESSION_NOT_FOUND_CODE = 'STREAM_SESSION_NOT_FOUND';
// 업로드가 이 시간 넘게 계속 실패하면 '다시 연결 중입니다' 안내를 띄운다
export const SURVEILLANCE_LOST_MS = 30_000;
const RECREATE_BACKOFF_MS = [2_000, 4_000, 8_000, 30_000];

// 프록시 자체의 404(허용되지 않는 요청)는 errorCode 가 없어 상태만으로는 구분되지 않는다
export function isSessionNotFound(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { errorCode?: unknown } } })?.response;
  return response?.status === 404 && response.data?.errorCode === SESSION_NOT_FOUND_CODE;
}

// attempt 0 → 2초, 1 → 4초, 2 → 8초, 3 이상 → 30초
export function getRecreateBackoffMs(attempt: number): number {
  return RECREATE_BACKOFF_MS[Math.min(Math.max(attempt, 0), RECREATE_BACKOFF_MS.length - 1)];
}

export function canRecreateSession(params: {
  now: number;
  nextAllowedAt: number;
  recreating: boolean;
  isStillStreaming: boolean;
}): boolean {
  return params.isStillStreaming && !params.recreating && params.now >= params.nextAllowedAt;
}

export function isSurveillanceLost(failSince: number | null, now: number): boolean {
  return failSince !== null && now - failSince >= SURVEILLANCE_LOST_MS;
}
