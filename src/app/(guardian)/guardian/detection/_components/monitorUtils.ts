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
