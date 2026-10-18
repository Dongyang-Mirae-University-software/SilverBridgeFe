// 송출 화질 자동 조절. 업로드가 느려지면(대역 부족) 해상도·JPEG 품질을 단계적으로 낮춰 끊기지 않고 꾸준히 보낸다.
// 하한은 AI 모델 입력 크기(640)다 - 그보다 작게는 내리지 않는다. 대역이 충분해지면 다시 올린다.

export type CaptureLevel = { maxWidth: number; quality: number };

export const CAPTURE_LEVELS: CaptureLevel[] = [
  { maxWidth: 1280, quality: 0.8 }, // 기본
  { maxWidth: 960, quality: 0.75 },
  { maxWidth: 800, quality: 0.7 },
  { maxWidth: 640, quality: 0.7 }, // 하한 (AI 모델 입력 크기)
];

export const SLOW_UPLOAD_MS = 400; // 업로드 한 장이 이보다 오래 걸리면 한 단계 내린다
export const STALL_MS = 1500; // 끝나지 않은 업로드가 이만큼 지나면 '막혔다'고 본다(순간의 지연으로는 내리지 않는다)
export const FAST_UPLOAD_MS = 150; // 이보다 빠르게 이어지면 한 단계 올린다
export const MIN_SAMPLES = 3;
export const DOWN_INTERVAL_MS = 2000; // 단계를 연달아 내리기까지 최소 간격(바뀐 화질의 결과를 보고 판단하도록)
export const BASE_UP_HOLD_MS = 15_000; // 내린 뒤 다시 올리기까지 기다리는 시간
export const MAX_UP_HOLD_MS = 120_000; // 올렸다 바로 내려가기를 반복하면 이만큼까지 늘린다
const EWMA_ALPHA = 0.3;

export function updateEwma(previous: number | null, sample: number): number {
  return previous === null ? sample : previous + EWMA_ALPHA * (sample - previous);
}

export function decideCaptureLevel(input: {
  level: number;
  ewmaMs: number | null;
  samples: number;
  // 아직 끝나지 않은 업로드 중 가장 오래된 것의 경과 시간 - 업로드가 아예 끝나지 않으면 표본이 안 쌓이므로 STALL_MS 넘게 걸리면 막힌 것으로 본다
  oldestInFlightMs: number;
  now: number;
  lastChangeAt: number;
  upHoldMs: number;
}): number {
  const last = CAPTURE_LEVELS.length - 1;
  const isStalled = input.oldestInFlightMs > STALL_MS;
  const isSlow = (input.ewmaMs ?? 0) > SLOW_UPLOAD_MS;
  const sinceChange = input.now - input.lastChangeAt;

  if ((isSlow || isStalled) && input.level < last && sinceChange >= DOWN_INTERVAL_MS) {
    return input.level + 1;
  }
  if (
    input.level > 0 &&
    input.samples >= MIN_SAMPLES &&
    input.ewmaMs !== null &&
    input.ewmaMs < FAST_UPLOAD_MS &&
    input.oldestInFlightMs < FAST_UPLOAD_MS * 2 &&
    sinceChange >= input.upHoldMs
  ) {
    return input.level - 1;
  }
  return input.level;
}

// 올린 직후 다시 내려가는 일이 반복되면 올리기 전 대기를 늘린다(올렸다 내렸다 하지 않게)
export function nextUpHoldMs(current: number, wentDown: boolean, msSinceLastUp: number): number {
  if (wentDown && msSinceLastUp < 30_000) return Math.min(current * 2, MAX_UP_HOLD_MS);
  return current;
}
