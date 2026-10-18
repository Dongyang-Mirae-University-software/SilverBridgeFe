import { describe, expect, it } from 'vitest';

import {
  BASE_UP_HOLD_MS,
  CAPTURE_LEVELS,
  DOWN_INTERVAL_MS,
  STALL_MS,
  MAX_UP_HOLD_MS,
  decideCaptureLevel,
  nextUpHoldMs,
  updateEwma,
} from './captureQuality';

const base = { level: 0, ewmaMs: 100 as number | null, samples: 10, oldestInFlightMs: 0, now: 100_000, lastChangeAt: 0, upHoldMs: BASE_UP_HOLD_MS };

describe('CAPTURE_LEVELS', () => {
  it('하한은 AI 모델 입력 크기(640)이고 단계는 작아지는 순서', () => {
    expect(CAPTURE_LEVELS[CAPTURE_LEVELS.length - 1].maxWidth).toBe(640);
    const widths = CAPTURE_LEVELS.map(level => level.maxWidth);
    expect([...widths].sort((a, b) => b - a)).toEqual(widths);
  });
});

describe('decideCaptureLevel', () => {
  it('업로드가 느리면 한 단계 내린다', () => {
    expect(decideCaptureLevel({ ...base, ewmaMs: 900 })).toBe(1);
  });
  it('끝나지 않는 업로드가 막힌 것으로 볼 만큼 오래되면 내린다(표본이 안 쌓여도)', () => {
    expect(decideCaptureLevel({ ...base, ewmaMs: null, samples: 0, oldestInFlightMs: STALL_MS + 1 })).toBe(1);
  });
  it('순간의 지연(진행 중 업로드 400~1500ms)과 정상 평균으로는 내리지 않는다', () => {
    expect(decideCaptureLevel({ ...base, level: 2, ewmaMs: 73, oldestInFlightMs: 428 })).toBe(2);
    expect(decideCaptureLevel({ ...base, ewmaMs: 100, oldestInFlightMs: STALL_MS })).toBe(0);
  });
  it('하한에서는 더 내리지 않는다', () => {
    const last = CAPTURE_LEVELS.length - 1;
    expect(decideCaptureLevel({ ...base, level: last, ewmaMs: 5000 })).toBe(last);
  });
  it('방금 바꿨으면 연달아 내리지 않는다', () => {
    expect(decideCaptureLevel({ ...base, ewmaMs: 900, now: 1000 + DOWN_INTERVAL_MS - 1, lastChangeAt: 1000 })).toBe(0);
    expect(decideCaptureLevel({ ...base, ewmaMs: 900, now: 1000 + DOWN_INTERVAL_MS, lastChangeAt: 1000 })).toBe(1);
  });
  it('빠르게 이어지고 대기 시간이 지나면 한 단계 올린다', () => {
    expect(decideCaptureLevel({ ...base, level: 2, ewmaMs: 80 })).toBe(1);
  });
  it('표본이 적거나 대기 시간 전이면 올리지 않는다', () => {
    expect(decideCaptureLevel({ ...base, level: 2, ewmaMs: 80, samples: 2 })).toBe(2);
    expect(decideCaptureLevel({ ...base, level: 2, ewmaMs: 80, now: 5000, lastChangeAt: 0 })).toBe(2);
  });
  it('기본 단계에서는 더 올리지 않고, 보통 속도(150~400ms)에서는 그대로', () => {
    expect(decideCaptureLevel({ ...base, level: 0, ewmaMs: 50 })).toBe(0);
    expect(decideCaptureLevel({ ...base, level: 1, ewmaMs: 250 })).toBe(1);
  });
});

describe('updateEwma / nextUpHoldMs', () => {
  it('첫 표본은 그대로, 이후는 부드럽게 따라간다', () => {
    expect(updateEwma(null, 200)).toBe(200);
    expect(updateEwma(200, 1000)).toBeGreaterThan(200);
    expect(updateEwma(200, 1000)).toBeLessThan(1000);
  });
  it('올린 직후 30초 안에 다시 내려가면 올리기 대기를 두 배로(상한까지)', () => {
    expect(nextUpHoldMs(15_000, true, 10_000)).toBe(30_000);
    expect(nextUpHoldMs(100_000, true, 10_000)).toBe(MAX_UP_HOLD_MS);
    expect(nextUpHoldMs(15_000, true, 60_000)).toBe(15_000);
    expect(nextUpHoldMs(15_000, false, 1_000)).toBe(15_000);
  });
});
