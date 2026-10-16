// 송출 세션 자동 복구 판정. AI 서버가 재시작되면 세션이 사라져 프레임 업로드가
// 404 STREAM_SESSION_NOT_FOUND 를 받는다 - 이때만 같은 카메라 정보로 세션을 다시 만든다.

export const SESSION_NOT_FOUND_CODE = 'STREAM_SESSION_NOT_FOUND';
// 업로드가 이 시간 넘게 계속 실패하면 '연결이 불안정해요' 표시를, 더 길어지면 '다시 연결 중입니다' 덮개를 띄운다
// (잠깐의 흔들림에는 아무것도 띄우지 않는다 - 프레임은 초당 10장 넘게 올라가 몇 장 실패는 흔하다)
export const UNSTABLE_MS = 10_000;
export const SURVEILLANCE_LOST_MS = 30_000;
const RECREATE_BACKOFF_MS = [2_000, 4_000, 8_000, 30_000];

// 프레임 업로드의 404 = 세션이 없다. AI 서버는 errorCode 가 든 JSON 으로 답하지만, 앞단 프록시(nginx)가 404 를
// HTML 페이지로 바꿔 돌려주어 브라우저에는 errorCode 가 없는 404 가 온다(2026-10-16 gosky 실측). 그래서 404 면서
// errorCode 가 없거나 SESSION_NOT_FOUND 일 때를 모두 '세션 없음'으로 본다. 다른 errorCode 가 든 404 는 제외.
// 업로드 경로 자체는 허용 경로뿐이라 다른 원인의 404 가 와도 재생성은 멱등이고 대기 시간(백오프)이 있어 해가 없다.
export function isSessionNotFound(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response;
  if (response?.status !== 404) return false;
  const errorCode = (response.data as { errorCode?: unknown } | null | undefined)?.errorCode;
  return errorCode === undefined || errorCode === SESSION_NOT_FOUND_CODE;
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

export function isUploadUnstable(failSince: number | null, now: number): boolean {
  return failSince !== null && now - failSince >= UNSTABLE_MS;
}

export function isSurveillanceLost(failSince: number | null, now: number): boolean {
  return failSince !== null && now - failSince >= SURVEILLANCE_LOST_MS;
}
