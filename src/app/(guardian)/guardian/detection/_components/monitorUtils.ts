import type { DetectState, GuardianCameraAnalysis, GuardianLiveCamera } from '@/service/interface/guardian/camera';

// 백엔드가 이미 깨끗한 camelCase로 내려주므로(snake_case·필드명 흔들림 없음) 더 이상
// 여러 필드명을 추측해서 맞춰주는 정규화 코드가 필요 없다 — 감지 종류만 배지 색상용으로 분류한다
export function resolveCameraDetectState(analysis: GuardianCameraAnalysis | null | undefined): DetectState {
  if (!analysis) return 'safe';
  const raw = (analysis.detectedType ?? '').toLowerCase();

  if (raw === 'fire') return 'fire';
  if (raw === 'smoke') return 'smoke';
  if (['knife', 'weapon', 'scissors', 'gun'].some(k => raw.includes(k))) return 'knife';
  if (['fall', 'fallen', 'tumble'].some(k => raw.includes(k))) return 'fall';
  if (['person', 'people', 'human'].some(k => raw.includes(k))) return 'person';
  if (analysis.danger) return 'danger';
  return 'safe';
}

export function formatNumber(value: number | null | undefined) {
  return value == null ? '-' : String(value);
}

// 실시간 카메라 모달을 처음 열 때 고를 카메라. 지정한 카메라가 있으면 그것, 없으면 (그 피보호자의) 송출 중인
// 카메라를 먼저 고른다 - 꺼진 카메라부터 열면 볼 것도 없는 영상 연결이 동시 시청 자리(1인 2개)를 먼저 차지한다.
export function pickInitialSessionId(
  sessions: Array<Pick<GuardianLiveCamera, 'sessionId' | 'wardId' | 'status'>>,
  initialSessionId?: string | null,
  initialWardId?: string,
): string | undefined {
  if (initialSessionId && sessions.some(session => session.sessionId === initialSessionId)) return initialSessionId;
  const candidates = initialWardId ? sessions.filter(session => session.wardId === initialWardId) : sessions;
  return (candidates.find(session => session.status === 'running') ?? candidates[0])?.sessionId;
}

type LiveStatus = GuardianLiveCamera['status'] | undefined;

// 보고 있는 카메라의 송출 상태가 바뀔 때 영상 연결을 어떻게 할지.
// 영상 주소에는 1회용 티켓이 들어 있어 한 번 끊기면 다시 쓸 수 없다(BE '영상 연결이 만료되었습니다').
// - 끊김(disconnected·offline)으로 바뀌면 써 버린 주소를 버린다('drop')
// - 끊김에서 송출 중(running)으로 돌아오면 새 티켓으로 다시 연다('reopen') - 상태가 바뀔 때 한 번뿐이라 반복 요청이 없다
// 다른 카메라로 바꾸는 중이거나 상태를 모르면(null·조회 전) 아무것도 하지 않는다 - 카메라 선택이 직접 연다.
export function getStreamResumeAction(
  previous: { sessionId: string | null; status: LiveStatus },
  next: { sessionId: string | null; status: LiveStatus },
): 'drop' | 'reopen' | 'none' {
  if (!next.sessionId || previous.sessionId !== next.sessionId || previous.status === next.status) return 'none';
  const wasDown = previous.status === 'disconnected' || previous.status === 'offline';
  const isDown = next.status === 'disconnected' || next.status === 'offline';
  if (isDown && !wasDown) return 'drop';
  if (wasDown && next.status === 'running') return 'reopen';
  return 'none';
}

// 보고 있는 카메라를 다시 골라야 하는지 - 목록에 카메라가 있는데 고른 카메라가 없을 때.
// 처음 열 때 목록이 비어 있었거나, 보는 사이 피보호자가 등록 해제 후 다시 등록해 세션이 바뀐 경우다
// (예전에는 사라진 세션을 붙든 채 '영상이 오지 않아요'만 보였다, 2026-10-15).
export function needsReselect(sessions: Array<Pick<GuardianLiveCamera, 'sessionId'>>, selectedId: string | null): boolean {
  return sessions.length > 0 && !sessions.some(session => session.sessionId === selectedId);
}
