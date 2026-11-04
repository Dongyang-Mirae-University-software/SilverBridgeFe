// 챗봇 음성 입력용 WAV 인코더. 브라우저마다 MediaRecorder 형식이 달라(iOS Safari는 audio/mp4 - 서버가 거부)
// Web Audio로 받은 PCM을 16kHz 모노 16bit WAV로 직접 만든다. 30초 ≈ 0.96MB(서버 상한 10MB).

export const WAV_SAMPLE_RATE = 16_000;
const WAV_HEADER_BYTES = 44;

// 여러 조각(Float32 -1~1)을 이어 붙인다
export function mergeChunks(chunks: readonly Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

// 구간 평균으로 줄인다(단순 솎아내기보다 고주파 접힘이 적다). 입력이 목표보다 낮으면 그대로 둔다
export function downsample(samples: Float32Array, inputRate: number, targetRate = WAV_SAMPLE_RATE): Float32Array {
  if (!(inputRate > targetRate)) return samples;
  const ratio = inputRate / targetRate;
  const outLength = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

// 16bit PCM 모노 WAV 바이트(RIFF 헤더 44바이트 + 데이터)
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt 청크 크기
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 모노
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate = rate × 채널 × 2바이트
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = WAV_HEADER_BYTES;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// 녹음 조각 → 16kHz WAV Blob
export function buildWavBlob(chunks: readonly Float32Array[], inputRate: number): Blob {
  const pcm = downsample(mergeChunks(chunks), inputRate, WAV_SAMPLE_RATE);
  const rate = inputRate > WAV_SAMPLE_RATE ? WAV_SAMPLE_RATE : inputRate;
  return new Blob([encodeWav(pcm, rate)], { type: 'audio/wav' });
}

// 무음 판단용 RMS
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}
