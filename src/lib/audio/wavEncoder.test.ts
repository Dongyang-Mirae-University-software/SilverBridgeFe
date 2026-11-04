import { describe, expect, it } from 'vitest';

import { WAV_SAMPLE_RATE, buildWavBlob, downsample, encodeWav, mergeChunks, rms } from './wavEncoder';

function ascii(view: DataView, offset: number, length: number) {
  return String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));
}

describe('encodeWav', () => {
  it('16bit PCM 모노 RIFF 헤더를 쓴다', () => {
    const view = new DataView(encodeWav(new Float32Array(100), 16_000));
    expect(ascii(view, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 200);
    expect(ascii(view, 8, 4)).toBe('WAVE');
    expect(ascii(view, 12, 4)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // 모노
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(28, true)).toBe(32_000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(200);
    expect(view.byteLength).toBe(44 + 200);
  });

  it('샘플을 -1~1로 자르고 16bit로 바꾼다', () => {
    const view = new DataView(encodeWav(Float32Array.from([0, 1, -1, 2, -2, 0.5]), 16_000));
    const read = (i: number) => view.getInt16(44 + i * 2, true);
    expect([read(0), read(1), read(2), read(3), read(4)]).toEqual([0, 32767, -32768, 32767, -32768]);
    expect(read(5)).toBe(Math.trunc(0.5 * 0x7fff));
  });
});

describe('downsample', () => {
  it('48kHz → 16kHz면 길이가 1/3이고 구간 평균을 쓴다', () => {
    const out = downsample(Float32Array.from([0.3, 0.3, 0.3, 0.6, 0.6, 0.6]), 48_000);
    expect(out.length).toBe(2);
    expect(out[0]).toBeCloseTo(0.3);
    expect(out[1]).toBeCloseTo(0.6);
  });

  it('44.1kHz처럼 나누어떨어지지 않아도 길이가 맞다', () => {
    expect(downsample(new Float32Array(44_100), 44_100).length).toBe(16_000);
  });

  it('목표보다 낮거나 같으면 그대로 둔다', () => {
    const samples = new Float32Array(10);
    expect(downsample(samples, 16_000)).toBe(samples);
    expect(downsample(samples, 8_000)).toBe(samples);
  });
});

describe('buildWavBlob', () => {
  it('조각을 이어 16kHz WAV Blob을 만든다 - 30초는 1MB 안쪽', async () => {
    const second = new Float32Array(48_000);
    const blob = buildWavBlob(Array.from({ length: 30 }, () => second), 48_000);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + 30 * WAV_SAMPLE_RATE * 2);
    expect(blob.size).toBeLessThan(1024 * 1024);
    const view = new DataView(await blob.arrayBuffer());
    expect(view.getUint32(24, true)).toBe(WAV_SAMPLE_RATE);
  });

  it('입력이 16kHz 이하면 그 샘플레이트를 헤더에 쓴다', async () => {
    const view = new DataView(await buildWavBlob([new Float32Array(8_000)], 8_000).arrayBuffer());
    expect(view.getUint32(24, true)).toBe(8_000);
  });
});

describe('mergeChunks·rms', () => {
  it('조각을 순서대로 잇는다', () => {
    expect(Array.from(mergeChunks([Float32Array.from([1, 2]), Float32Array.from([3])]))).toEqual([1, 2, 3]);
  });

  it('RMS를 계산한다(빈 배열은 0)', () => {
    expect(rms(new Float32Array(0))).toBe(0);
    expect(rms(Float32Array.from([0.5, -0.5]))).toBeCloseTo(0.5);
  });
});
