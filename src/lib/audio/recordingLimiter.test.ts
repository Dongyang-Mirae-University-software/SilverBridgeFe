import { describe, expect, it } from 'vitest';

import { MAX_RECORDING_MS, RecordingLimiter, SILENCE_STOP_MS, SPEECH_RMS_THRESHOLD } from './recordingLimiter';

const CHUNK_MS = 4096 / 48; // 48kHz에서 4096샘플 ≈ 85ms
const LOUD = SPEECH_RMS_THRESHOLD * 4;
const QUIET = SPEECH_RMS_THRESHOLD / 4;

function run(limiter: RecordingLimiter, level: number, ms: number) {
  let result = limiter.push(level, 0);
  for (let t = 0; t < ms && result === 'continue'; t += CHUNK_MS) result = limiter.push(level, CHUNK_MS);
  return result;
}

describe('RecordingLimiter', () => {
  it('30초가 되면 끝낸다(계속 말하는 중이어도)', () => {
    const limiter = new RecordingLimiter();
    expect(run(limiter, LOUD, MAX_RECORDING_MS + 1000)).toBe('max');
    expect(limiter.elapsed).toBeGreaterThanOrEqual(MAX_RECORDING_MS);
    expect(limiter.elapsed).toBeLessThan(MAX_RECORDING_MS + CHUNK_MS);
  });

  it('말하기 전 무음은 끊지 않는다 - 30초 상한에서만 끝난다', () => {
    expect(run(new RecordingLimiter(), QUIET, MAX_RECORDING_MS + 1000)).toBe('max');
  });

  it('말한 뒤 무음이 1.5초 이어지면 끝낸다', () => {
    const limiter = new RecordingLimiter();
    expect(run(limiter, LOUD, 2000)).toBe('continue');
    const before = limiter.elapsed;
    expect(run(limiter, QUIET, 5000)).toBe('silence');
    expect(limiter.elapsed - before).toBeGreaterThanOrEqual(SILENCE_STOP_MS);
    expect(limiter.elapsed - before).toBeLessThan(SILENCE_STOP_MS + CHUNK_MS);
  });

  it('무음 중 다시 말하면 무음 시간을 처음부터 센다', () => {
    const limiter = new RecordingLimiter();
    run(limiter, LOUD, 500);
    expect(run(limiter, QUIET, 1000)).toBe('continue');
    run(limiter, LOUD, 200);
    expect(run(limiter, QUIET, 1000)).toBe('continue');
  });
});
