'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { MAX_RECORDING_MS, RecordingLimiter } from '@/lib/audio/recordingLimiter';
import { buildWavBlob, rms } from '@/lib/audio/wavEncoder';
import { STT_MESSAGES, getSttErrorMessage } from '@/service/api/chatSttPolicy';
import { transcribeChatAudio } from '@/service/api/chatStt';

export type VoiceInputState = 'idle' | 'recording' | 'uploading';

// 이보다 짧으면 서버에 보내지 않는다(잘못 누른 것)
const MIN_RECORDING_MS = 300;

type AudioContextCtor = typeof AudioContext;

type VoiceInputOptions<T> = {
  // 녹음한 WAV를 보낼 곳. 없으면 챗봇 받아쓰기(글자를 돌려준다)
  send?: (audio: Blob, signal: AbortSignal) => Promise<T>;
  // 실패를 직접 안내할 때(안부 말벗 - 오류 code마다 할 일이 다르다). 없으면 받아쓰기 안내 문구를 보인다
  onError?: (error: unknown) => void;
  // 말한 뒤 이만큼 조용하면 녹음을 끝낸다(기본 1.5초 - 피보호자 챗봇은 3초)
  silenceMs?: number;
};

function getAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
}

type Recording = {
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  chunks: Float32Array[];
  limiter: RecordingLimiter;
  maxTimer: ReturnType<typeof setTimeout>;
  tickTimer: ReturnType<typeof setInterval>;
  startedAt: number;
};

// 챗봇 마이크 음성 입력. 누르면 녹음, 다시 누르면(또는 30초·말이 멈추면) 끝내고 서버에서 글자로 바꿔 onText로 넘긴다.
// 보낼지는 onText가 정한다(보호자: 입력창에 채움, 피보호자: 바로 보냄). 음성·글자는 메모리에만 두고 저장·로그하지 않는다. 브라우저 SpeechRecognition은 쓰지 않는다(팀 결정).
// options.send를 주면 받아쓰기 대신 그곳으로 보내고 받은 결과를 넘긴다(안부 말벗 음성 대답)
export function useVoiceInput<T = string>(onText: (result: T) => void, options?: VoiceInputOptions<T>) {
  const [state, setState] = useState<VoiceInputState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const onTextRef = useRef(onText);
  const optionsRef = useRef(options);
  useEffect(() => {
    onTextRef.current = onText;
    optionsRef.current = options;
  }, [onText, options]);
  const recordingRef = useRef<Recording | null>(null);
  // 권한 창이 떠 있는 동안 두 번째 누름을 막는다(state는 비동기라 같은 틱을 못 막는다)
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const releaseAudio = useCallback((recording: Recording) => {
    clearTimeout(recording.maxTimer);
    clearInterval(recording.tickTimer);
    recording.processor.onaudioprocess = null;
    try {
      recording.processor.disconnect();
      recording.source.disconnect();
    } catch {
      // 이미 끊긴 노드
    }
    recording.stream.getTracks().forEach(track => track.stop());
    void recording.context.close().catch(() => undefined);
  }, []);

  const finish = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    releaseAudio(recording);

    const durationMs = recording.limiter.elapsed;
    if (durationMs < MIN_RECORDING_MS || recording.chunks.length === 0) {
      busyRef.current = false;
      setState('idle');
      setNotice(STT_MESSAGES.empty);
      return;
    }

    const blob = buildWavBlob(recording.chunks, recording.context.sampleRate);
    recording.chunks.length = 0;
    setState('uploading');

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const send = optionsRef.current?.send ?? (transcribeChatAudio as unknown as NonNullable<VoiceInputOptions<T>['send']>);
      const result = await send(blob, controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return;
      if (result === '') setNotice(STT_MESSAGES.empty);
      else onTextRef.current(result);
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) return;
      const onError = optionsRef.current?.onError;
      if (onError) onError(error);
      else setNotice(getSttErrorMessage(error));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      busyRef.current = false;
      if (mountedRef.current) setState('idle');
    }
  }, [releaseAudio]);

  const start = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setNotice(null);

    const AudioCtx = getAudioContextCtor();
    if (!AudioCtx || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      busyRef.current = false;
      setNotice(STT_MESSAGES.unsupported);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      // 거부(NotAllowedError)·장치 없음(NotFoundError)·사용 중 - 서버는 부르지 않는다
      busyRef.current = false;
      if (mountedRef.current) setNotice(STT_MESSAGES.permission);
      return;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    try {
      const context = new AudioCtx();
      // iOS Safari는 권한 창을 거치면 suspended로 시작할 수 있다
      if (context.state === 'suspended') await context.resume().catch(() => undefined);
      const source = context.createMediaStreamSource(stream);
      // AudioWorklet은 별도 모듈 파일이 필요해 모든 브라우저가 지원하는 ScriptProcessor를 쓴다
      const processor = context.createScriptProcessor(4096, 1, 1);
      const limiter = new RecordingLimiter(MAX_RECORDING_MS, optionsRef.current?.silenceMs);
      const chunks: Float32Array[] = [];
      const startedAt = Date.now();

      const recording: Recording = {
        stream,
        context,
        source,
        processor,
        chunks,
        limiter,
        startedAt,
        // 오디오 콜백이 멈춰도(탭 전환 등) 30초에서 끝낸다
        maxTimer: setTimeout(() => void finish(), MAX_RECORDING_MS + 500),
        tickTimer: setInterval(() => setElapsedSec(Math.min(30, Math.floor((Date.now() - startedAt) / 1000))), 250),
      };

      processor.onaudioprocess = event => {
        if (recordingRef.current !== recording) return;
        const input = event.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input);
        chunks.push(copy);
        const result = limiter.push(rms(copy), (copy.length / context.sampleRate) * 1000);
        if (result !== 'continue') void finish();
      };

      source.connect(processor);
      // 크롬은 출력에 연결해야 onaudioprocess를 부른다. 출력 버퍼는 비워 두어 소리는 나지 않는다
      processor.connect(context.destination);

      recordingRef.current = recording;
      setElapsedSec(0);
      setState('recording');
    } catch {
      stream.getTracks().forEach(track => track.stop());
      busyRef.current = false;
      setNotice(STT_MESSAGES.generic);
    }
  }, [finish]);

  const toggle = useCallback(() => {
    if (recordingRef.current) {
      void finish();
      return;
    }
    if (state === 'idle') void start();
  }, [finish, start, state]);

  // 녹음·업로드를 버린다(대화창 전환·화면 이탈). 받은 글자는 쓰지 않는다
  const cancel = useCallback(() => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (recording) releaseAudio(recording);
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setState('idle');
  }, [releaseAudio]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recording = recordingRef.current;
      recordingRef.current = null;
      if (recording) releaseAudio(recording);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [releaseAudio]);

  const clearNotice = useCallback(() => setNotice(null), []);

  return { state, elapsedSec, notice, toggle, cancel, clearNotice };
}
