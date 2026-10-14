// 피보호자 기기 -> 백엔드(/ws/camera-upload) H.264 송출 모듈 (영상 전송 H.264 PoC, 2026-10-14)
//
// 계약: BE docs/(2026-10-14) design-video-transport-contract.md
//  - 첫 텍스트 메시지: {type:'config', codec, width, height, framerate, format:'annexb'}
//  - 이후 바이너리: [8B 타임스탬프(us, big-endian)][1B 플래그 bit0=키프레임][H.264 Annex B]
//  - 서버 -> 클라이언트 텍스트: {type:'keyframe_request'}
//
// 이 모듈은 캔버스 -> VideoFrame -> VideoEncoder -> WebSocket 만 맡는다. 폴백 판단·재연결은 호출자 몫이다.
// 로그에는 티켓·영상 원문을 남기지 않는다(이벤트 카운터만 getStats()로 읽는다).

export const H264_CODEC = 'avc1.42E01F'; // Baseline 3.1 - 폰 하드웨어 인코더 호환이 가장 넓다
const KEYFRAME_INTERVAL_MS = 2000;
const MAX_ENCODE_QUEUE = 2;
// 소켓 송신 대기가 이만큼 쌓이면 새 프레임을 건너뛴다(지연 누적 방지). 델타를 버리면 참조가 깨져 다음 프레임을 키프레임으로 보낸다.
const MAX_BUFFERED_BYTES = 512 * 1024;
const OPEN_TIMEOUT_MS = 5000;
const DEFAULT_BITRATE = 1_500_000;

export interface WebSocketLike {
  binaryType: string;
  readyState: number;
  bufferedAmount: number;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface EncodedChunkLike {
  type: 'key' | 'delta';
  timestamp: number;
  byteLength: number;
  copyTo(destination: Uint8Array): void;
}

export interface VideoEncoderLike {
  encodeQueueSize: number;
  state: string;
  configure(config: Record<string, unknown>): void;
  encode(frame: VideoFrameLike, options?: { keyFrame?: boolean }): void;
  flush(): Promise<void>;
  close(): void;
}

export interface VideoFrameLike {
  close(): void;
}

export interface CanvasLike {
  width: number;
  height: number;
}

export interface H264Deps {
  createSocket(url: string): WebSocketLike;
  createEncoder(init: {
    output: (chunk: EncodedChunkLike) => void;
    error: (error: unknown) => void;
  }): VideoEncoderLike;
  createFrame(source: CanvasLike, init: { timestamp: number }): VideoFrameLike;
  now(): number;
}

export interface SenderClosedInfo {
  code: number;
  reason: string;
  // 연결이 수립(config 전송)된 뒤에 닫혔는가
  wasOpen: boolean;
}

export interface SenderStats {
  encoded: number;
  keyframes: number;
  bytes: number;
  skippedQueue: number;
  skippedBuffer: number;
  skippedResync: number;
  keyframeRequests: number;
  reconfigures: number;
}

export interface H264SenderOptions {
  url: string;
  framerate: number;
  bitrate?: number;
  // 서버·네트워크가 연결을 닫았다(우리가 close()한 경우는 부르지 않는다)
  onClosed: (info: SenderClosedInfo) => void;
  // 인코더 오류 등 이 세션에서 H.264를 계속할 수 없다
  onFatal: (reason: string) => void;
  deps?: Partial<H264Deps>;
}

// H.264는 가로·세로가 짝수여야 한다
export function evenSize(width: number, height: number) {
  return { width: Math.max(2, Math.floor(width / 2) * 2), height: Math.max(2, Math.floor(height / 2) * 2) };
}

export function buildEncoderConfig(width: number, height: number, framerate: number, bitrate = DEFAULT_BITRATE) {
  return {
    codec: H264_CODEC,
    width,
    height,
    framerate,
    bitrate,
    bitrateMode: 'variable',
    latencyMode: 'realtime',
    hardwareAcceleration: 'no-preference',
    avc: { format: 'annexb' },
  };
}

export function buildConfigMessage(width: number, height: number, framerate: number) {
  return JSON.stringify({ type: 'config', codec: H264_CODEC, width, height, framerate, format: 'annexb' });
}

// [8B 타임스탬프(us)][1B 플래그][데이터]
export function frameMessage(timestampUs: number, isKey: boolean, data: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(9 + data.byteLength);
  const view = new DataView(out);
  view.setBigUint64(0, BigInt(Math.max(0, Math.floor(timestampUs))));
  view.setUint8(8, isKey ? 1 : 0);
  new Uint8Array(out, 9).set(data);
  return out;
}

function browserDeps(): H264Deps {
  return {
    createSocket: url => {
      const socket = new WebSocket(url);
      socket.binaryType = 'arraybuffer';
      return socket as unknown as WebSocketLike;
    },
    createEncoder: init => new VideoEncoder(init) as unknown as VideoEncoderLike,
    createFrame: (source, init) => new VideoFrame(source as unknown as CanvasImageSource, init) as unknown as VideoFrameLike,
    now: () => performance.now(),
  };
}

export class H264Sender {
  private readonly options: H264SenderOptions;
  private readonly deps: H264Deps;
  private socket: WebSocketLike | null = null;
  private encoder: VideoEncoderLike | null = null;
  private width = 0;
  private height = 0;
  private ready = false;
  private closed = false;
  private needKeyframe = true;
  private reconfiguring = false;
  private lastKeyAt = 0;
  private startedAt = 0;
  private readonly stats: SenderStats = {
    encoded: 0,
    keyframes: 0,
    bytes: 0,
    skippedQueue: 0,
    skippedBuffer: 0,
    skippedResync: 0,
    keyframeRequests: 0,
    reconfigures: 0,
  };

  constructor(options: H264SenderOptions) {
    this.options = options;
    this.deps = { ...browserDeps(), ...options.deps } as H264Deps;
  }

  getStats(): SenderStats {
    return { ...this.stats };
  }

  get isReady() {
    return this.ready && !this.closed;
  }

  // 연결을 맺고 config를 보낸다. 5초 안에 열리지 않거나 그 전에 닫히면 거절한다.
  open(width: number, height: number): Promise<void> {
    const size = evenSize(width, height);
    this.width = size.width;
    this.height = size.height;

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => {
        this.shutdown();
        settle(new Error('open_timeout'));
      }, OPEN_TIMEOUT_MS);

      let socket: WebSocketLike;
      try {
        socket = this.deps.createSocket(this.options.url);
      } catch {
        clearTimeout(timer);
        reject(new Error('socket_create_failed'));
        return;
      }
      this.socket = socket;

      socket.onopen = () => {
        try {
          this.encoder = this.deps.createEncoder({
            output: chunk => this.handleOutput(chunk),
            error: () => this.fatal('encoder_error'),
          });
          this.encoder.configure(buildEncoderConfig(this.width, this.height, this.options.framerate, this.options.bitrate));
          socket.send(buildConfigMessage(this.width, this.height, this.options.framerate));
        } catch {
          this.shutdown();
          settle(new Error('encoder_setup_failed'));
          return;
        }
        this.ready = true;
        this.startedAt = this.deps.now();
        this.needKeyframe = true;
        settle();
      };
      socket.onmessage = event => this.handleServerMessage(event.data);
      socket.onerror = () => {
        // 상세 원인은 브라우저가 주지 않는다. close 이벤트가 이어서 온다.
      };
      socket.onclose = event => {
        const wasOpen = this.ready;
        const alreadyClosed = this.closed;
        this.closed = true;
        this.shutdown();
        if (!settled) {
          settle(new Error(`closed_before_open:${event.code}`));
          return;
        }
        if (!alreadyClosed) this.options.onClosed({ code: event.code, reason: event.reason, wasOpen });
      };
    });
  }

  // 캔버스 한 장을 인코더에 넣는다. 넣었으면 true, 건너뛰었으면 false.
  push(canvas: CanvasLike): boolean {
    if (!this.isReady || !this.encoder || !this.socket || this.reconfiguring) return false;

    const size = evenSize(canvas.width, canvas.height);
    if (size.width !== this.width || size.height !== this.height) {
      this.reconfigure(size.width, size.height);
      return false;
    }
    if (this.encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
      this.stats.skippedQueue += 1;
      return false;
    }
    if (this.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      this.stats.skippedBuffer += 1;
      this.needKeyframe = true; // 델타를 버렸으니 다음은 키프레임부터 다시 시작한다
      return false;
    }

    const now = this.deps.now();
    const isKey = this.needKeyframe || now - this.lastKeyAt >= KEYFRAME_INTERVAL_MS;
    let frame: VideoFrameLike | null = null;
    try {
      frame = this.deps.createFrame(canvas, { timestamp: Math.round((now - this.startedAt) * 1000) });
      this.encoder.encode(frame, isKey ? { keyFrame: true } : undefined);
    } catch {
      this.fatal('encode_failed');
      return false;
    } finally {
      frame?.close();
    }
    if (isKey) {
      this.needKeyframe = false;
      this.lastKeyAt = now;
    }
    return true;
  }

  // 우리가 끊는다. onClosed는 부르지 않는다.
  close() {
    this.closed = true;
    this.shutdown();
  }

  private handleOutput(chunk: EncodedChunkLike) {
    const socket = this.socket;
    if (!socket || this.closed || socket.readyState !== 1) return;
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    const isKey = chunk.type === 'key';
    try {
      socket.send(frameMessage(chunk.timestamp, isKey, data));
    } catch {
      this.fatal('send_failed');
      return;
    }
    this.stats.encoded += 1;
    this.stats.bytes += data.byteLength;
    if (isKey) this.stats.keyframes += 1;
  }

  private handleServerMessage(data: unknown) {
    if (typeof data !== 'string') return;
    try {
      const message = JSON.parse(data) as { type?: string };
      if (message.type === 'keyframe_request') {
        this.stats.keyframeRequests += 1;
        this.needKeyframe = true;
      }
    } catch {
      // 알 수 없는 텍스트는 무시한다
    }
  }

  // 회전·해상도 변경: 이전 해상도의 출력을 모두 내보낸 뒤 새 config + 키프레임으로 바꾼다.
  private reconfigure(width: number, height: number) {
    const encoder = this.encoder;
    const socket = this.socket;
    if (!encoder || !socket || this.reconfiguring) return;
    this.reconfiguring = true;
    this.stats.reconfigures += 1;
    void encoder
      .flush()
      .catch(() => undefined)
      .then(() => {
        if (this.closed || this.encoder !== encoder) return;
        try {
          this.width = width;
          this.height = height;
          encoder.configure(buildEncoderConfig(width, height, this.options.framerate, this.options.bitrate));
          socket.send(buildConfigMessage(width, height, this.options.framerate));
          this.needKeyframe = true;
        } catch {
          this.fatal('reconfigure_failed');
        } finally {
          this.reconfiguring = false;
        }
      });
  }

  private fatal(reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.shutdown();
    this.options.onFatal(reason);
  }

  private shutdown() {
    this.ready = false;
    const encoder = this.encoder;
    const socket = this.socket;
    this.encoder = null;
    this.socket = null;
    try {
      if (encoder && encoder.state !== 'closed') encoder.close();
    } catch {
      // 이미 닫힌 인코더
    }
    try {
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        // 우리가 닫는 것이므로 close 이벤트가 onClosed(비정상 종료 처리)로 이어지지 않게 핸들러를 먼저 뗀다
        socket.onclose = null;
        socket.close(1000, 'client_close');
      }
    } catch {
      // 이미 닫힌 소켓
    }
  }
}
