import { describe, expect, it, vi } from 'vitest';

import {
  H264Sender,
  buildConfigMessage,
  buildEncoderConfig,
  evenSize,
  frameMessage,
  type CanvasLike,
  type EncodedChunkLike,
  type H264Deps,
  type SenderClosedInfo,
  type VideoEncoderLike,
  type VideoFrameLike,
  type WebSocketLike,
} from './h264Sender';

class FakeSocket implements WebSocketLike {
  binaryType = 'arraybuffer';
  readyState = 0;
  bufferedAmount = 0;
  sent: Array<string | ArrayBuffer> = [];
  closedWith: { code?: number; reason?: string } | null = null;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  send(data: string | ArrayBuffer) {
    this.sent.push(data);
  }
  close(code?: number, reason?: string) {
    this.readyState = 3;
    this.closedWith = { code, reason };
  }
  // 시험 도우미
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  serverClose(code: number, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
  serverText(text: string) {
    this.onmessage?.({ data: text });
  }
}

class FakeEncoder implements VideoEncoderLike {
  encodeQueueSize = 0;
  state = 'unconfigured';
  configs: Array<Record<string, unknown>> = [];
  encodes: Array<{ key: boolean }> = [];
  flushed = 0;
  throwOnEncode = false;
  constructor(readonly output: (chunk: EncodedChunkLike) => void, readonly error: (error: unknown) => void) {}
  configure(config: Record<string, unknown>) {
    this.configs.push(config);
    this.state = 'configured';
  }
  encode(_frame: VideoFrameLike, options?: { keyFrame?: boolean }) {
    if (this.throwOnEncode) throw new Error('boom');
    this.encodes.push({ key: Boolean(options?.keyFrame) });
  }
  async flush() {
    this.flushed += 1;
  }
  close() {
    this.state = 'closed';
  }
  emit(type: 'key' | 'delta', data: number[], timestamp = 0) {
    this.output({
      type,
      timestamp,
      byteLength: data.length,
      copyTo: destination => destination.set(data),
    });
  }
}

function setup(overrides: { framerate?: number } = {}) {
  let socket!: FakeSocket;
  let encoder!: FakeEncoder;
  let clock = 0;
  const frames: Array<{ closed: boolean }> = [];
  const deps: H264Deps = {
    createSocket: () => (socket = new FakeSocket()),
    createEncoder: init => (encoder = new FakeEncoder(init.output, init.error)),
    createFrame: () => {
      const frame = { closed: false, close() { this.closed = true; } };
      frames.push(frame);
      return frame;
    },
    now: () => clock,
  };
  const closed: SenderClosedInfo[] = [];
  const fatal: string[] = [];
  const sender = new H264Sender({
    url: 'wss://api.example/ws/camera-upload?ticket=ut_x',
    framerate: overrides.framerate ?? 15,
    onClosed: info => closed.push(info),
    onFatal: reason => fatal.push(reason),
    deps,
  });
  return {
    sender,
    closed,
    fatal,
    frames,
    get socket() { return socket; },
    get encoder() { return encoder; },
    advance: (ms: number) => { clock += ms; },
  };
}

const canvas = (width: number, height: number): CanvasLike => ({ width, height });

describe('메시지 형식', () => {
  it('config 는 계약의 JSON 이다', () => {
    expect(JSON.parse(buildConfigMessage(640, 360, 15))).toEqual({
      type: 'config', codec: 'avc1.42E01F', width: 640, height: 360, framerate: 15, format: 'annexb',
    });
  });

  it('프레임 메시지 = [8B 타임스탬프(us, 빅엔디안)][1B 플래그][데이터]', () => {
    const message = frameMessage(0x0102030405, true, new Uint8Array([9, 8, 7]));
    const bytes = new Uint8Array(message);
    expect(bytes.byteLength).toBe(12);
    expect(Array.from(bytes.slice(0, 8))).toEqual([0, 0, 0, 1, 2, 3, 4, 5]);
    expect(bytes[8]).toBe(1);
    expect(Array.from(bytes.slice(9))).toEqual([9, 8, 7]);
    expect(new Uint8Array(frameMessage(0, false, new Uint8Array([1])))[8]).toBe(0);
  });

  it('인코더 설정은 annexb·realtime·Baseline 이다', () => {
    expect(buildEncoderConfig(1280, 720, 15)).toMatchObject({
      codec: 'avc1.42E01F', width: 1280, height: 720, framerate: 15, bitrate: 1_500_000,
      latencyMode: 'realtime', avc: { format: 'annexb' },
    });
  });

  it('해상도는 짝수로 맞춘다', () => {
    expect(evenSize(1281, 721)).toEqual({ width: 1280, height: 720 });
    expect(evenSize(640, 360)).toEqual({ width: 640, height: 360 });
  });
});

describe('H264Sender', () => {
  it('열리면 config 를 먼저 보내고 인코더를 설정한다', async () => {
    const t = setup();
    const opened = t.sender.open(1280, 720);
    t.socket.open();
    await opened;

    expect(typeof t.socket.sent[0]).toBe('string');
    expect(JSON.parse(t.socket.sent[0] as string)).toMatchObject({ type: 'config', width: 1280, height: 720, framerate: 15 });
    expect(t.encoder.configs[0]).toMatchObject({ width: 1280, height: 720 });
    expect(t.sender.isReady).toBe(true);
  });

  it('열리기 전에 닫히면 open 이 거절된다(onClosed 는 부르지 않는다)', async () => {
    const t = setup();
    const opened = t.sender.open(640, 360);
    t.socket.serverClose(1006);
    await expect(opened).rejects.toThrow('closed_before_open');
    expect(t.closed).toHaveLength(0);
  });

  it('첫 프레임은 키프레임이고 그 뒤 2초마다 키프레임이다', async () => {
    const t = setup();
    const opened = t.sender.open(640, 360);
    t.socket.open();
    await opened;

    t.sender.push(canvas(640, 360));
    for (let i = 0; i < 10; i += 1) {
      t.advance(66);
      t.sender.push(canvas(640, 360));
    }
    t.advance(1500);
    t.sender.push(canvas(640, 360));

    expect(t.encoder.encodes[0].key).toBe(true);
    expect(t.encoder.encodes.slice(1, 11).every(e => !e.key)).toBe(true);
    expect(t.encoder.encodes[11].key).toBe(true);
    // VideoFrame 은 매번 닫는다(메모리 누수 방지)
    expect(t.frames.every(frame => frame.closed)).toBe(true);
  });

  it('인코더 출력은 계약 형식으로 소켓에 보낸다', async () => {
    const t = setup();
    const opened = t.sender.open(640, 360);
    t.socket.open();
    await opened;

    t.encoder.emit('key', [0, 0, 0, 1, 0x67], 1000);
    t.encoder.emit('delta', [0, 0, 0, 1, 0x41], 2000);

    const key = new Uint8Array(t.socket.sent[1] as ArrayBuffer);
    const delta = new Uint8Array(t.socket.sent[2] as ArrayBuffer);
    expect(key[8]).toBe(1);
    expect(delta[8]).toBe(0);
    expect(Array.from(key.slice(9))).toEqual([0, 0, 0, 1, 0x67]);
    expect(t.sender.getStats()).toMatchObject({ encoded: 2, keyframes: 1 });
  });

  it('인코더 큐가 밀리면 입력 단계에서 건너뛴다', async () => {
    const t = setup();
    const opened = t.sender.open(640, 360);
    t.socket.open();
    await opened;

    t.encoder.encodeQueueSize = 3;
    expect(t.sender.push(canvas(640, 360))).toBe(false);
    expect(t.encoder.encodes).toHaveLength(0);
    expect(t.sender.getStats().skippedQueue).toBe(1);

    t.encoder.encodeQueueSize = 2;
    expect(t.sender.push(canvas(640, 360))).toBe(true);
  });

  it('소켓 송신 대기가 쌓이면 건너뛰고 다음 프레임은 키프레임으로 다시 시작한다', async () => {
    const t = setup();
    const opened = t.sender.open(640, 360);
    t.socket.open();
    await opened;
    t.sender.push(canvas(640, 360)); // 키프레임

    t.advance(66);
    t.socket.bufferedAmount = 600 * 1024;
    expect(t.sender.push(canvas(640, 360))).toBe(false);
    expect(t.sender.getStats().skippedBuffer).toBe(1);

    t.socket.bufferedAmount = 0;
    t.advance(66);
    t.sender.push(canvas(640, 360));
    expect(t.encoder.encodes[1].key).toBe(true);
  });

  it('keyframe_request 를 받으면 다음 프레임을 키프레임으로 보낸다', async () => {
    const t = setup();
    const opened = t.sender.open(640, 360);
    t.socket.open();
    await opened;
    t.sender.push(canvas(640, 360));

    t.socket.serverText(JSON.stringify({ type: 'keyframe_request' }));
    t.advance(66);
    t.sender.push(canvas(640, 360));

    expect(t.encoder.encodes[1].key).toBe(true);
    expect(t.sender.getStats().keyframeRequests).toBe(1);
  });

  it('해상도(회전)가 바뀌면 flush 뒤 새 config 를 보내고 키프레임부터 다시 시작한다', async () => {
    const t = setup();
    const opened = t.sender.open(1280, 720);
    t.socket.open();
    await opened;
    t.sender.push(canvas(1280, 720));

    t.advance(66);
    // 90도 회전: 가로세로가 바뀐다. 건너뛰고 재설정이 시작된다
    expect(t.sender.push(canvas(720, 1280))).toBe(false);
    await Promise.resolve();
    await Promise.resolve();

    const configs = t.socket.sent.filter(m => typeof m === 'string').map(m => JSON.parse(m as string));
    expect(configs).toHaveLength(2);
    expect(configs[1]).toMatchObject({ type: 'config', width: 720, height: 1280 });
    expect(t.encoder.flushed).toBe(1);
    expect(t.encoder.configs[1]).toMatchObject({ width: 720, height: 1280 });

    t.advance(66);
    expect(t.sender.push(canvas(720, 1280))).toBe(true);
    expect(t.encoder.encodes.at(-1)?.key).toBe(true);
  });

  it('홀수 크기 캔버스는 짝수로 맞춰 config 에 쓴다', async () => {
    const t = setup();
    const opened = t.sender.open(1281, 721);
    t.socket.open();
    await opened;
    expect(JSON.parse(t.socket.sent[0] as string)).toMatchObject({ width: 1280, height: 720 });
    // 같은 홀수 크기의 다음 캔버스는 재설정을 일으키지 않는다
    expect(t.sender.push(canvas(1281, 721))).toBe(true);
    expect(t.sender.getStats().reconfigures).toBe(0);
  });

  it('서버가 연결을 닫으면 onClosed 로 코드·사유를 알린다', async () => {
    const t = setup();
    const opened = t.sender.open(640, 360);
    t.socket.open();
    await opened;

    t.socket.serverClose(1008, 'AUTH_INVALIDATED');

    expect(t.closed).toEqual([{ code: 1008, reason: 'AUTH_INVALIDATED', wasOpen: true }]);
    expect(t.sender.isReady).toBe(false);
    expect(t.encoder.state).toBe('closed');
    expect(t.sender.push(canvas(640, 360))).toBe(false);
  });

  it('우리가 close() 하면 onClosed 를 부르지 않고 인코더·소켓을 정리한다', async () => {
    const t = setup();
    const opened = t.sender.open(640, 360);
    t.socket.open();
    await opened;

    t.sender.close();

    expect(t.closed).toHaveLength(0);
    expect(t.socket.closedWith).toEqual({ code: 1000, reason: 'client_close' });
    expect(t.encoder.state).toBe('closed');
  });

  it('인코더 예외는 onFatal 이고 연결을 정리한다', async () => {
    const t = setup();
    const opened = t.sender.open(640, 360);
    t.socket.open();
    await opened;

    t.encoder.throwOnEncode = true;
    expect(t.sender.push(canvas(640, 360))).toBe(false);

    expect(t.fatal).toEqual(['encode_failed']);
    expect(t.sender.isReady).toBe(false);
    expect(t.frames.every(frame => frame.closed)).toBe(true);
  });

  it('열리는 데 5초가 넘으면 거절한다', async () => {
    vi.useFakeTimers();
    try {
      const t = setup();
      const opened = t.sender.open(640, 360);
      const assertion = expect(opened).rejects.toThrow('open_timeout');
      await vi.advanceTimersByTimeAsync(5001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
