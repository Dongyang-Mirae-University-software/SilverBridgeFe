import type { DetectState, GuardianCameraAnalysis } from '@/service/interface/guardian/camera';

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
