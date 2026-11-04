// 녹음을 언제 끝낼지 판단한다. 벽시계가 아니라 받은 오디오 길이로 센다(탭이 잠시 멈춰도 30초 상한이 정확하다).
// - 30초가 되면 끝낸다(서버 상한).
// - 말소리가 한 번 잡힌 뒤 무음이 1.5초 이어지면 끝낸다. 말하기 전 망설이는 동안은 끊지 않는다.

export const MAX_RECORDING_MS = 30_000;
export const SILENCE_STOP_MS = 1_500;
// 말소리로 볼 RMS(-1~1 기준). 조용한 방의 배경 잡음(~0.003~0.01)보다 높고 보통 말소리(~0.03~0.2)보다 낮게 둔다
export const SPEECH_RMS_THRESHOLD = 0.015;

export type LimiterResult = 'continue' | 'max' | 'silence';

export class RecordingLimiter {
  private elapsedMs = 0;
  private silentMs = 0;
  private heardSpeech = false;

  constructor(
    private readonly maxMs = MAX_RECORDING_MS,
    private readonly silenceMs = SILENCE_STOP_MS,
    private readonly threshold = SPEECH_RMS_THRESHOLD,
  ) {}

  push(chunkRms: number, chunkMs: number): LimiterResult {
    this.elapsedMs += chunkMs;
    if (chunkRms >= this.threshold) {
      this.heardSpeech = true;
      this.silentMs = 0;
    } else if (this.heardSpeech) {
      this.silentMs += chunkMs;
    }
    if (this.elapsedMs >= this.maxMs) return 'max';
    if (this.heardSpeech && this.silentMs >= this.silenceMs) return 'silence';
    return 'continue';
  }

  get elapsed() {
    return this.elapsedMs;
  }
}
