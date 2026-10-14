'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { createStreamSession, stopStreamSession, uploadFrame } from '@/service/api/streamSession';
import { getWardCameras } from '@/service/api/ward/camera';
import { Icon } from '@/components/Icon';
import { getHttpStatus, getRetryAfterMs } from '@/lib/api/streamClient';
import { getStoredDeviceId, setStoredDeviceId } from '@/lib/device/deviceId';
import {
  useRegisterWardCameraMutation,
  wardCameraRoomsQueryOptions,
  wardLiveCamerasQueryKey,
} from '@/service/query/ward/camera';
import { WardCamera } from '@/service/interface/ward/camera';
import { ALREADY_STREAMING, getModalTitle } from './cameraAction';
import { RoomPicker } from './RoomPicker';
import styles from './CameraRegisterModal.module.css';

const cx = classNames.bind(styles);

type CameraFacing = 'user' | 'environment' | 'screen';
type StreamStatus = 'off' | 'ready' | 'streaming';
type FrameRotation = 0 | 90 | 180 | 270;
type WakeLockSentinelLike = { released: boolean; release: () => Promise<void> };

const CAMERA_ROTATION_STORAGE_KEY = 'silverbridge_ward_camera_rotation';
const MAX_IN_FLIGHT = 2;
// 연속 업로드 실패가 이 횟수 또는 시간을 넘으면 사용자에게 알린다
const UNSTABLE_FAIL_COUNT = 5;
const UNSTABLE_FAIL_MS = 3000;
// 화면 공유는 getDisplayMedia에 크기 제한이 없어 원본 해상도 그대로 올라간다 — 가로 1280으로 줄여서 업로드 속도를 맞춘다
const MAX_CAPTURE_WIDTH = 1280;
const MEDIA_PERMISSION_MESSAGE = '카메라·화면 접근 권한이 필요합니다.';
const RESTART_FAILED_MESSAGE = '카메라를 켜지 못했습니다. 잠시 후 다시 시도해 주세요.';

const FACING_OPTIONS: Array<{ value: CameraFacing; label: string }> = [
  { value: 'user', label: '전면 카메라' },
  { value: 'environment', label: '후면 카메라' },
  { value: 'screen', label: '화면 공유' },
];

function getErrorCode(error: unknown) {
  return (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
}

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { message?: string })?.message ?? fallback;
}

function getStoredRotation(): FrameRotation {
  try {
    const value = Number(window.localStorage.getItem(CAMERA_ROTATION_STORAGE_KEY));
    return value === 90 || value === 180 || value === 270 ? value : 0;
  } catch {
    return 0;
  }
}

function setStoredRotation(rotation: FrameRotation) {
  try {
    window.localStorage.setItem(CAMERA_ROTATION_STORAGE_KEY, String(rotation));
  } catch {
    // 저장을 지원하지 않는 환경에서는 이번 실행 중 선택값만 사용한다.
  }
}

export type CameraRegisterModalHandle = { turnOn: () => Promise<string | null> };

export function CameraRegisterModal({
  initialRoom,
  isCameraRunning = false,
  isOpen,
  onClose,
  onUnstableChange,
  ref,
}: {
  // 페이지의 '카메라 켜기' 버튼이 모달을 열지 않고 바로 송출을 시작할 때 쓴다.
  // 실패 사유(고정 문구)를 돌려주고, 성공하거나 이미 켜져 있으면 null.
  ref?: Ref<CameraRegisterModalHandle>;
  // 이 기기가 쓰던 카메라가 끊겨서 다시 켤 때 — 원래 쓰던 방을 미리 선택해 둔다.
  // 같은 기기·같은 방으로 다시 등록하면 백엔드가 기존 sessionId를 그대로 재사용한다
  initialRoom?: string;
  isCameraRunning?: boolean;
  isOpen: boolean;
  onClose: () => void;
  // 송출 업로드가 계속 실패 중인지 알린다(모달이 닫혀 있어도 페이지가 안내할 수 있게)
  onUnstableChange?: (unstable: boolean) => void;
}) {
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [status, setStatus] = useState<StreamStatus>('off');
  const [room, setRoom] = useState(initialRoom ?? '');
  const [errorMessage, setErrorMessage] = useState('');
  const [registeredCamera, setRegisteredCamera] = useState<WardCamera | null>(null);
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [isUnstable, setIsUnstable] = useState(false);
  // 이미 카메라가 있으면 설정 단계를 줄이고 전송 화면은 기본으로 접는다. 새로 등록할 때는 확인이 필요해 펼친다.
  // 방금 이 화면에서 새로 등록해 송출을 시작한 경우는 송출을 끌 때까지 등록 화면을 유지한다
  // (등록 직후 목록이 갱신돼 initialRoom 이 채워져도 확인 중이던 화면이 갑자기 바뀌지 않게)
  const [isNewSession, setIsNewSession] = useState(false);
  const isExisting = Boolean(initialRoom) && !isNewSession;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const isPreviewVisible = !isExisting || isPreviewOpen;
  // 서버와 첫 브라우저 렌더는 같은 기본값으로 맞추고, 저장된 기기별 값은 마운트 후 읽는다.
  const [rotation, setRotation] = useState<FrameRotation>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureWorkerRef = useRef<Worker | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveSessionIdRef = useRef<string | null>(null);
  const frameQueueRef = useRef<Blob[]>([]);
  const inFlightRef = useRef(0);
  const rotationRef = useRef<FrameRotation>(rotation);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const pausedUntilRef = useRef(0);
  // 권한 프롬프트·재시작 중 중복 실행 방지(state 는 비동기라 같은 틱의 두 번째 호출을 못 막는다)
  const startingRef = useRef(false);
  const failCountRef = useRef(0);
  const failSinceRef = useRef<number | null>(null);
  const onUnstableChangeRef = useRef(onUnstableChange);
  onUnstableChangeRef.current = onUnstableChange;

  const { data: rooms = [], refetch: refetchRooms } = useQuery(wardCameraRoomsQueryOptions);
  const registerMutation = useRegisterWardCameraMutation();
  const queryClient = useQueryClient();

  // 모달은 송출을 유지하기 위해 항상 마운트돼 있다. 따라서 카메라 목록이 나중에
  // 도착한 경우에도, 다시 열 때 기존 카메라의 방을 등록 대상으로 채워야 한다.
  useEffect(() => {
    if (isOpen && status === 'off' && initialRoom) setRoom(initialRoom);
  }, [initialRoom, isOpen, status]);

  useEffect(() => {
    return () => {
      captureWorkerRef.current?.terminate();
      captureWorkerRef.current = null;
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      void wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    setRotation(getStoredRotation());
  }, []);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  async function requestScreenWakeLock() {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!wakeLock || wakeLockRef.current && !wakeLockRef.current.released) return;

    try {
      wakeLockRef.current = await wakeLock.request('screen');
    } catch {
      // 지원하지 않거나 권한이 거부된 브라우저는 송출을 계속한다.
    }
  }

  async function releaseScreenWakeLock() {
    const wakeLock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (wakeLock && !wakeLock.released) await wakeLock.release().catch(() => {});
  }

  useEffect(() => {
    const requestWakeLockWhenVisible = () => {
      if (document.visibilityState === 'visible' && liveSessionIdRef.current) void requestScreenWakeLock();
    };

    document.addEventListener('visibilitychange', requestWakeLockWhenVisible);
    return () => document.removeEventListener('visibilitychange', requestWakeLockWhenVisible);
  }, []);

  // 카메라·화면 권한을 받아 미리보기 루프까지 시작한다. 실패하면 false.
  const openMedia = async (): Promise<boolean> => {
    // 이전 스트림이 남아 있으면(중복 호출 등) 참조를 덮어쓰기 전에 트랙을 먼저 끈다
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    try {
      const stream =
        facing === 'screen'
          ? await navigator.mediaDevices.getDisplayMedia({ video: true })
          : await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: facing,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 15 },
              },
              audio: false,
            });

      mediaStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus('ready');
      startPreviewLoop();
      return true;
    } catch {
      return false;
    }
  };

  const handleStartMedia = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setErrorMessage('');
    try {
      if (!(await openMedia())) setErrorMessage(MEDIA_PERMISSION_MESSAGE);
    } finally {
      startingRef.current = false;
    }
  };

  const updateUnstable = (unstable: boolean) => {
    setIsUnstable(prev => {
      if (prev !== unstable) onUnstableChangeRef.current?.(unstable);
      return unstable;
    });
  };

  const resetUploadHealth = () => {
    pausedUntilRef.current = 0;
    failCountRef.current = 0;
    failSinceRef.current = null;
    updateUnstable(false);
  };

  const handleUploadFailure = (error: unknown) => {
    // 429: 서버가 쉬라고 한 시간만큼 업로드를 멈춘다(새 프레임은 계속 최신으로 덮어쓴다)
    if (getHttpStatus(error) === 429) pausedUntilRef.current = Date.now() + getRetryAfterMs(error);

    const now = Date.now();
    failCountRef.current += 1;
    failSinceRef.current ??= now;
    if (failCountRef.current >= UNSTABLE_FAIL_COUNT || now - failSinceRef.current >= UNSTABLE_FAIL_MS) {
      updateUnstable(true);
    }
  };

  const handleStopMedia = async () => {
    resetUploadHealth();
    const sessionId = liveSessionIdRef.current;
    liveSessionIdRef.current = null;
    if (sessionId) await stopStreamSession(sessionId).catch(() => {});
    captureWorkerRef.current?.terminate();
    captureWorkerRef.current = null;
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    frameQueueRef.current = [];
    await releaseScreenWakeLock();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('off');
    setRegisteredCamera(null);
    setIsNewSession(false);
    // 끈 상태가 15초 폴링을 기다리지 않고 바로 보이게 한다
    void queryClient.invalidateQueries({ queryKey: wardLiveCamerasQueryKey });
  };

  // 모달을 닫아도 카메라와 업로드 루프를 유지한다. 이 컴포넌트는 숨긴 채로 남아
  // video/canvas ref와 송출 세션이 끊기지 않도록 WardCameraContent에서 계속 마운트한다.
  const handleClose = () => onClose();

  const enqueueLatestFrame = (blob: Blob) => {
    if (!liveSessionIdRef.current) return;
    frameQueueRef.current = [blob];
    if (Date.now() < pausedUntilRef.current) return;
    void drainQueue();
  };

  const drainQueue = () => {
    while (inFlightRef.current < MAX_IN_FLIGHT && frameQueueRef.current.length > 0 && liveSessionIdRef.current) {
      const blob = frameQueueRef.current.pop();
      const sessionId = liveSessionIdRef.current;
      frameQueueRef.current = [];
      if (!blob || !sessionId) return;

      inFlightRef.current += 1;
      void uploadFrame(sessionId, blob)
        .then(resetUploadHealth)
        .catch(handleUploadFailure)
        .finally(() => {
          inFlightRef.current -= 1;
          void drainQueue();
        });
    }
  };

  const drawFrameToCanvas = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;

    const srcWidth = video.videoWidth || 1280;
    const srcHeight = video.videoHeight || 720;
    const scale = Math.min(1, MAX_CAPTURE_WIDTH / srcWidth);
    const width = Math.round(srcWidth * scale);
    const height = Math.round(srcHeight * scale);
    const currentRotation = rotationRef.current;
    const shouldSwapDimensions = currentRotation === 90 || currentRotation === 270;
    const context = canvas.getContext('2d');
    if (!context) return false;

    canvas.width = shouldSwapDimensions ? height : width;
    canvas.height = shouldSwapDimensions ? width : height;
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((currentRotation * Math.PI) / 180);
    context.drawImage(video, -width / 2, -height / 2, width, height);
    context.restore();
    return true;
  };

  const startPreviewLoop = () => {
    if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    previewTimerRef.current = setInterval(drawFrameToCanvas, Math.floor(1000 / 15));
  };

  // 화면 공유로 다른 탭·창을 띄우면 이 탭이 숨겨져 메인 스레드 setInterval이 1초에 1번으로
  // 제한된다. Worker 안의 타이머는 이 제한을 받지 않아 recommendedFps를 그대로 유지할 수 있다
  const startCaptureLoop = (recommendedFps: number) => {
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    if (!captureWorkerRef.current) {
      captureWorkerRef.current = new Worker('/capture-timer.js');
      captureWorkerRef.current.onmessage = () => {
        if (!drawFrameToCanvas()) return;
        canvasRef.current?.toBlob(blob => blob && enqueueLatestFrame(blob), 'image/jpeg', 0.8);
      };
    }

    const intervalMs = Math.max(Math.floor(1000 / Math.max(recommendedFps, 1)), 1);
    captureWorkerRef.current.postMessage(intervalMs);
  };

  const startStreaming = async (camera: WardCamera) => {
    const session = await createStreamSession({
      sessionId: camera.sessionId,
      cameraIdentifier: camera.deviceId,
      deviceType: 'web',
    });
    resetUploadHealth();
    liveSessionIdRef.current = session.session_id ?? camera.sessionId;
    setRegisteredCamera(camera);
    setIsNewSession(!initialRoom);
    setStatus('streaming');
    startCaptureLoop(camera.recommendedFps);
    void requestScreenWakeLock();
    // 방금 켠 상태가 바로 보이도록 15초 폴링을 기다리지 않고 한 번 갱신한다(등록·켜기 공통)
    void queryClient.invalidateQueries({ queryKey: wardLiveCamerasQueryKey });
  };

  // 이미 등록된 이 기기의 카메라로 송출만 재개한다. 실패 사유(고정 문구)를 돌려주고 성공이면 null.
  const restartExistingCamera = async (): Promise<string | null> => {
    const deviceId = getStoredDeviceId();
    if (!deviceId) return '이 기기의 카메라 정보를 찾지 못했습니다. 다시 등록해 주세요.';

    setIsStartingStream(true);
    try {
      // 같은 기기는 이미 카메라로 등록돼 있다. 등록 API를 다시 호출하면 방 중복으로
      // 거절될 수 있으므로, 기존 카메라의 sessionId로 송출만 재개한다.
      const cameras = await getWardCameras();
      const camera = cameras.find(item => item.deviceId === deviceId);
      if (!camera) return '등록된 카메라 정보를 찾지 못했습니다. 다시 등록해 주세요.';
      await startStreaming(camera);
      return null;
    } catch {
      return RESTART_FAILED_MESSAGE;
    } finally {
      setIsStartingStream(false);
    }
  };

  // '카메라 켜기' 한 번 흐름: 권한 → 기존 카메라로 송출 재개. 실패하면 켠 미디어를 정리하고 사유를 돌려준다.
  const turnOnCamera = async (): Promise<string | null> => {
    // 이미 이 탭이 송출 중이면 호출자가 화면을 열어 보여 주게 한다(조용히 무반응이지 않도록)
    if (status === 'streaming') return ALREADY_STREAMING;
    if (startingRef.current || isStartingStream || registerMutation.isPending) return null;

    startingRef.current = true;
    setIsStartingStream(true);
    setErrorMessage('');
    try {
      const hasMedia = status === 'ready' || (await openMedia());
      if (!hasMedia) return MEDIA_PERMISSION_MESSAGE;
      const failure = await restartExistingCamera();
      if (failure) await handleStopMedia();
      return failure;
    } finally {
      startingRef.current = false;
      setIsStartingStream(false);
    }
  };

  useImperativeHandle(ref, () => ({ turnOn: turnOnCamera }));

  const handleRegister = () => {
    if (!room || registerMutation.isPending || isStartingStream) return;
    setErrorMessage('');

    if (initialRoom && room === initialRoom) {
      void restartExistingCamera().then(failure => failure && setErrorMessage(failure));
      return;
    }

    registerMutation.mutate(
      { label: room, deviceId: getStoredDeviceId() },
      {
        onSuccess: async camera => {
          if (!camera) return;
          setStoredDeviceId(camera.deviceId);
          try {
            await startStreaming(camera);
          } catch {
            setErrorMessage('카메라 등록은 완료됐지만 송출 시작에 실패했습니다. 다시 시도해 주세요.');
          }
        },
        onError: error => {
          // 그 사이 다른 기기가 같은 방을 먼저 등록했을 수 있다 — 방 목록을 새로 받아서 바로잡는다
          if (getErrorCode(error) === 'CAMERA_LABEL_DUPLICATED') {
            void refetchRooms();
            setRoom('');
            setErrorMessage('방금 다른 기기에서 그 방을 등록했어요. 다른 방을 골라 주세요.');
            return;
          }
          setErrorMessage(getErrorMessage(error, '카메라 등록에 실패했습니다. 다시 시도해 주세요.'));
        },
      },
    );
  };

  // 모달 안의 '카메라 켜기' - 실패 사유는 모달 오류 영역에 보인다
  const handleTurnOn = () => {
    void turnOnCamera().then(failure => failure && failure !== ALREADY_STREAMING && setErrorMessage(failure));
  };

  const handleRotate = () => {
    setRotation(current => {
      const next = ((current + 90) % 360) as FrameRotation;
      setStoredRotation(next);
      return next;
    });
  };

  return (
    <div className={cx('overlay', { hidden: !isOpen })} role="presentation" aria-hidden={!isOpen} onClick={handleClose}>
      <div
        className={cx('modal')}
        role="dialog"
        aria-modal={isOpen || undefined}
        aria-label="카메라 등록"
        inert={!isOpen}
        onClick={event => event.stopPropagation()}
      >
        <header className={cx('header')}>
          <strong>
            <Icon name="camera" size={26} decorative />
            {getModalTitle(initialRoom, status === 'streaming')}
          </strong>
          <button type="button" className={cx('closeButton')} onClick={handleClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={cx('body')}>
          {!isExisting && <section className={cx('setupSection')}>
            <h2>1. 어디에 두셨나요?</h2>
            <RoomPicker
              rooms={rooms}
              selectedLabel={room}
              availableRegisteredLabel={initialRoom}
              disabled={status === 'streaming'}
              onSelect={setRoom}
            />
          </section>}

          {!isExisting && <section className={cx('setupSection')}>
            <h2>2. 기기를 이렇게 놓아 주세요</h2>
            <div className={cx('cameraGuide')}>
              <svg className={cx('guideIllustration')} viewBox="0 0 104 80" fill="none" aria-hidden="true">
                <path d="M8 74H96" stroke="#cfc6bc" strokeWidth="2.5" strokeLinecap="round" />
                <rect x="26" y="12" width="40" height="54" rx="6" fill="#fff" stroke="var(--sb-brand)" strokeWidth="2.5" transform="rotate(-8 46 39)" />
                <circle cx="44" cy="20" r="2.4" fill="var(--sb-brand)" transform="rotate(-8 46 39)" />
                <path d="m56 66 8 8" stroke="var(--sb-brand)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M62 60q16-2 18 10v4" stroke="#8a827b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <rect x="76" y="66" width="10" height="8" rx="2" fill="#8a827b" />
                <path d="m8 22 10 6M8 38h10m-10 16 10-6" stroke="#cfc6bc" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <div>
                <p>방 전체가 보이는 곳에 세워 두고, 화면을 켠 채 충전기를 연결해 주세요.</p>
                <p>휴대폰을 <strong>가로</strong>로 두고, 방 전체가 보이도록 <strong>위에서 아래로</strong> 비춰 주세요.</p>
              </div>
            </div>
          </section>}

          <section className={cx('setupSection')}>
            <h2>{isExisting ? '촬영 방식' : '3. 촬영 방식을 골라 주세요'}</h2>
            <div className={cx('facingRow')}>
              {FACING_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={cx('facingChip', { active: facing === option.value })}
                  onClick={() => setFacing(option.value)}
                  disabled={status !== 'off'}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className={cx('setupSection')}>
            <h2>{isExisting ? '전송 화면' : '4. 미리보기를 확인해 주세요'}</h2>
            <div className={cx('previewRow')}>
              {/* 캔버스는 송출용 toBlob 원본이라 접어도 DOM에 남긴다(높이만 0) */}
              <div className={cx('previewBox', { collapsed: !isPreviewVisible })} aria-hidden={!isPreviewVisible}>
                <video ref={videoRef} className={cx('sourceVideo')} autoPlay muted playsInline />
                <div className={cx('sentPreview')}>
                  <span>AI에 전송되는 화면</span>
                  <canvas ref={canvasRef} className={cx('canvas')} />
                </div>
              </div>
              <div className={cx('previewControls')}>
                {status === 'off' ? (
                  <button
                    type="button"
                    className={cx('previewButton')}
                    disabled={isExisting && isStartingStream}
                    onClick={isExisting ? handleTurnOn : handleStartMedia}
                  >
                    <Icon name="camera" size={20} decorative />
                    {isExisting ? (isStartingStream ? '카메라 켜는 중...' : '카메라 켜기') : '미리보기 시작'}
                  </button>
                ) : (
                  <button type="button" className={cx('previewButton', 'stop')} onClick={handleStopMedia}>
                    <Icon name="camera" size={20} decorative />
                    {status === 'streaming' ? (isExisting ? '카메라 끄기' : '등록 취소하고 끄기') : '미리보기 끄기'}
                  </button>
                )}
                {isExisting && status === 'streaming' && (
                  <button
                    type="button"
                    className={cx('rotateButton')}
                    aria-expanded={isPreviewVisible}
                    onClick={() => setIsPreviewOpen(open => !open)}
                  >
                    <span>{isPreviewVisible ? '전송 화면 접기' : '전송 화면 보기'}</span>
                  </button>
                )}
                {status !== 'off' && (
                  <button type="button" className={cx('rotateButton')} onClick={handleRotate}>
                    <Icon name="cameraFlip" size={20} decorative />
                    <span>화면 회전</span>
                    <strong>{rotation}°</strong>
                  </button>
                )}
              </div>
            </div>
            {isPreviewVisible && (
              <p className={cx('previewHint')}>AI에 전송되는 작은 미리보기에서 사람이 똑바로 보이는지 확인해 주세요.</p>
            )}
            {isExisting && status === 'off' && isCameraRunning && (
              <p className={cx('previewHint')}>
                이 화면에서는 아직 송출하고 있지 않아요. &quot;카메라 켜기&quot;를 누르면 이어서 보내요.
              </p>
            )}
          </section>

          {status === 'ready' && (
            <button
              type="button"
              className={cx('registerButton')}
              disabled={!room || registerMutation.isPending || isStartingStream}
              onClick={handleRegister}
            >
              {registerMutation.isPending || isStartingStream
                ? '송출 시작 중...'
                : initialRoom && room === initialRoom
                  ? '촬영 다시 시작'
                  : '등록하고 촬영 시작'}
            </button>
          )}

          {status === 'streaming' && registeredCamera && (
            <p className={cx('streamingNotice')}>
              &quot;{registeredCamera.label}&quot; 카메라가 송출 중입니다. 완료를 눌러도 백그라운드에서 촬영을 계속해요.
            </p>
          )}

          {status === 'streaming' && isUnstable && (
            <p className={cx('error')}>송출이 불안정합니다. 네트워크 상태를 확인해 주세요. 연결되면 자동으로 이어집니다.</p>
          )}

          {errorMessage && <p className={cx('error')}>{errorMessage}</p>}
        </div>

        {status === 'streaming' && (
          <footer className={cx('footer')}>
            <button type="button" className={cx('doneButton')} onClick={handleClose}>
              완료
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
