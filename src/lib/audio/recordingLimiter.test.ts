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

  it('무음 기준을 3초로 주면 말한 뒤 3초 무음에서 끝낸다(피보호자 챗봇)', () => {
    const limiter = new RecordingLimiter(MAX_RECORDING_MS, 3000);
    run(limiter, LOUD, 1000);
    const before = limiter.elapsed;
    expect(run(limiter, QUIET, 2500)).toBe('continue');
    expect(run(limiter, QUIET, 5000)).toBe('silence');
    expect(limiter.elapsed - before).toBeGreaterThanOrEqual(3000);
    expect(limiter.elapsed - before).toBeLessThan(3000 + CHUNK_MS);
  });

  it('휴대폰처럼 배경 잡음이 고정 기준보다 커도 말이 끝나면 무음으로 보고 끝낸다', () => {
    const noise = SPEECH_RMS_THRESHOLD * 1.6; // 자동 음량 조절로 커진 잡음
    const limiter = new RecordingLimiter(MAX_RECORDING_MS, 3000);
    run(limiter, noise, 1000);
    // 말소리 - 음절 사이 짧은 틈은 잡음 수준
    for (let i = 0; i < 12; i++) {
      run(limiter, 0.15, 150);
      run(limiter, noise, 80);
    }
    const before = limiter.elapsed;
    expect(run(limiter, noise, 10_000)).toBe('silence');
    // 잡음 바닥을 따라잡는 시간을 더해도 4.5초 안에 끝난다(전에는 30초까지 기다렸다)
    expect(limiter.elapsed - before).toBeLessThan(4500);
  });

  it('잡음이 한 번 튄 것만으로는 말한 것으로 보지 않는다', () => {
    const limiter = new RecordingLimiter();
    run(limiter, QUIET, 500);
    limiter.push(LOUD, CHUNK_MS);
    expect(run(limiter, QUIET, 5000)).toBe('continue');
  });
});
