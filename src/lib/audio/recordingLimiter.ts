// 녹음을 언제 끝낼지 판단한다. 벽시계가 아니라 받은 오디오 길이로 센다(탭이 잠시 멈춰도 30초 상한이 정확하다).
// - 30초가 되면 끝낸다(서버 상한).
// - 말소리가 잡힌 뒤 무음이 silenceMs(기본 1.5초, 피보호자 챗봇 3초) 이어지면 끝낸다. 말하기 전 망설이는 동안은 끊지 않는다.
// - 말소리 기준은 고정값(SPEECH_RMS_THRESHOLD)과 "지금 배경 잡음 × NOISE_FACTOR" 중 큰 값이다(2026-11-11).
//   휴대폰 마이크는 자동 음량 조절로 조용할 때 잡음을 키워 고정값을 넘기기도 해, 고정값만 쓰면 무음을 못 잡아
//   [끝내기]를 눌러야 끝났다. 잡음 바닥은 내려갈 때는 바로 따라가고(말 사이 잠깐 쉬는 틈) 올라갈 때는 천천히,
//   NOISE_FLOOR_CAP까지만 올라간다(길게 이어 말해도 말소리를 무음으로 보지 않게).

export const MAX_RECORDING_MS = 30_000;
export const SILENCE_STOP_MS = 1_500;
// 말소리로 볼 RMS(-1~1 기준). 조용한 방의 배경 잡음(~0.003~0.01)보다 높고 보통 말소리(~0.03~0.2)보다 낮게 둔다
export const SPEECH_RMS_THRESHOLD = 0.015;
export const NOISE_FACTOR = 2;
export const NOISE_FLOOR_CAP = 0.025;
// 잡음 바닥이 올라갈 때의 시간 상수
const FLOOR_RISE_TAU_MS = 4_000;
// 이만큼 말소리가 쌓여야 "말했다"로 본다(잡음 한두 번 튄 것으로 무음 카운트를 시작하지 않게)
const MIN_SPEECH_MS = 150;

export type LimiterResult = 'continue' | 'max' | 'silence';

export class RecordingLimiter {
  private elapsedMs = 0;
  private silentMs = 0;
  private speechMs = 0;
  private noiseFloor: number;

  constructor(
    private readonly maxMs = MAX_RECORDING_MS,
    private readonly silenceMs = SILENCE_STOP_MS,
    private readonly threshold = SPEECH_RMS_THRESHOLD,
  ) {
    // 처음에는 조용한 방으로 본다(말소리 기준 = 고정값)
    this.noiseFloor = threshold / NOISE_FACTOR;
  }

  push(chunkRms: number, chunkMs: number): LimiterResult {
    this.elapsedMs += chunkMs;

    const speechLevel = Math.max(this.threshold, this.noiseFloor * NOISE_FACTOR);
    if (chunkRms >= speechLevel) {
      this.speechMs += chunkMs;
      this.silentMs = 0;
    } else if (this.heardSpeech) {
      this.silentMs += chunkMs;
    }

    if (chunkRms < this.noiseFloor) this.noiseFloor = chunkRms;
    else {
      const rise = 1 - Math.exp(-chunkMs / FLOOR_RISE_TAU_MS);
      this.noiseFloor = Math.min(NOISE_FLOOR_CAP, this.noiseFloor + (chunkRms - this.noiseFloor) * rise);
    }

    if (this.elapsedMs >= this.maxMs) return 'max';
    if (this.heardSpeech && this.silentMs >= this.silenceMs) return 'silence';
    return 'continue';
  }

  private get heardSpeech() {
    return this.speechMs >= MIN_SPEECH_MS;
  }

  get elapsed() {
    return this.elapsedMs;
  }
}
