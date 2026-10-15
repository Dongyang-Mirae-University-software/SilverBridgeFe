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
import { WardCamera, type WardCameraConnectionStatus } from '@/service/interface/ward/camera';
import {
  ALREADY_STREAMING,
  AUTO_ROTATE_HINT,
  getCaptureSize,
  getCardStatus,
  getModalTitle,
  getVisibleFacings,
  isPortraitFrame,
  parseStoredFacing,
  type CameraFacing,
} from './cameraAction';
import { registerAndStart } from './registerFlow';
import { RoomPicker } from './RoomPicker';
import styles from './CameraRegisterModal.module.css';

const cx = classNames.bind(styles);

type StreamStatus = 'off' | 'ready' | 'streaming';
type WakeLockSentinelLike = { released: boolean; release: () => Promise<void> };

// 예전 '화면 회전' 설정 값. 회전 기능을 없애 더는 읽지 않고, 남아 있으면 한 번 지운다
const LEGACY_ROTATION_STORAGE_KEY = 'silverbridge_ward_camera_rotation';
const CAMERA_FACING_STORAGE_KEY = 'silverbridge_ward_camera_facing';
const MAX_IN_FLIGHT = 2;
// 연속 업로드 실패가 이 횟수 또는 시간을 넘으면 사용자에게 알린다
const UNSTABLE_FAIL_COUNT = 5;
const UNSTABLE_FAIL_MS = 3000;
const MEDIA_PERMISSION_MESSAGE = '카메라를 켜지 못했어요. 브라우저의 카메라 권한을 확인해 주세요.';
const RESTART_FAILED_MESSAGE = '카메라를 켜지 못했어요. 잠시 후 다시 시도해 주세요.';
const START_AFTER_REGISTER_FAILED_MESSAGE = '카메라는 등록됐지만 촬영을 시작하지 못했어요. 아래 버튼을 눌러 다시 시작해 주세요.';
const VIEW_GUARDIAN_NOTICE = '연결된 보호자도 이 화면을 볼 수 있어요. 이상 상황이 생기면 보호자에게 영상과 함께 알려 드려요.';

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

function clearLegacyRotation() {
  try {
    window.localStorage.removeItem(LEGACY_ROTATION_STORAGE_KEY);
  } catch {
    // 저장소를 쓸 수 없는 환경이면 지울 것도 없다.
  }
}

function getStoredFacing(): CameraFacing {
  try {
    return parseStoredFacing(window.localStorage.getItem(CAMERA_FACING_STORAGE_KEY));
  } catch {
    return 'user';
  }
}

function setStoredFacing(facing: CameraFacing) {
  try {
    window.localStorage.setItem(CAMERA_FACING_STORAGE_KEY, facing);
  } catch {
    // 저장을 지원하지 않는 환경에서는 이번 실행 중 선택값만 사용한다.
  }
}

export type CameraRegisterModalHandle = {
  turnOn: () => Promise<string | null>;
  // 이 탭의 송출을 끈다(이 기기의 카메라를 등록 해제했을 때 - 지워진 카메라로 계속 보내지 않게)
  turnOff: () => Promise<void>;
};

export function CameraRegisterModal({
  initialRoom,
  isCameraRunning = false,
  connectionStatus = null,
  isConnecting = false,
  isOpen,
  onClose,
  onUnstableChange,
  onStartingChange,
  onStreamingChange,
  ref,
}: {
  // 페이지의 '카메라 켜기' 버튼이 모달을 열지 않고 바로 송출을 시작할 때 쓴다.
  // 실패 사유(고정 문구)를 돌려주고, 성공하거나 이미 켜져 있으면 null.
  ref?: Ref<CameraRegisterModalHandle>;
  // 이 기기가 쓰던 카메라가 끊겨서 다시 켤 때 — 원래 쓰던 방을 미리 선택해 둔다.
  // 같은 기기·같은 방으로 다시 등록하면 백엔드가 기존 sessionId를 그대로 재사용한다
  initialRoom?: string;
  isCameraRunning?: boolean;
  // 화면 보기 제목 옆 배지용 - 카드와 같은 기준으로 보여 준다
  connectionStatus?: WardCameraConnectionStatus;
  isConnecting?: boolean;
  isOpen: boolean;
  onClose: () => void;
  // 송출 업로드가 계속 실패 중인지 알린다(모달이 닫혀 있어도 페이지가 안내할 수 있게)
  onUnstableChange?: (unstable: boolean) => void;
  // 이 기기가 송출을 시작하는 중인지 알린다(카드의 '연결하는 중' 표시용)
  onStartingChange?: (starting: boolean) => void;
  // 이 탭이 송출 중인지 알린다(송출 직후 서버가 'running'이 되기 전까지 카드가 '연결하는 중'을 보이게)
  onStreamingChange?: (streaming: boolean) => void;
}) {
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [status, setStatus] = useState<StreamStatus>('off');
  const [room, setRoom] = useState(initialRoom ?? '');
  const [errorMessage, setErrorMessage] = useState('');
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [isUnstable, setIsUnstable] = useState(false);
  // 지금 카메라 영상이 세로인지(자동 회전 안내용)
  const [isPortrait, setIsPortrait] = useState(false);
  // 이미 카메라가 있으면 설정 단계를 줄이고 전송 화면은 기본으로 접는다. 새로 등록할 때는 확인이 필요해 펼친다.
  // 등록하는 동안에는 화면을 고정한다 - 등록 직후 목록이 갱신돼 initialRoom 이 먼저 채워져도
  // 창이 닫히기 전에 '카메라 켜기' 화면으로 잠깐 바뀌지 않게
  const [isRegistering, setIsRegistering] = useState(false);
  const isExisting = Boolean(initialRoom) && !isRegistering;
  // 기존 카메라는 송출 중일 때 전송 화면만 보여 준다(촬영 방식은 끄면 다시 고를 수 있다)
  const isViewOnly = isExisting && status === 'streaming';
  // 화면 공유 칩은 시연용 - 쓰고 있거나 주소에 ?screen=1 이 있을 때만 보인다
  const [allowScreenShare, setAllowScreenShare] = useState(false);
  const visibleFacings = getVisibleFacings(facing, allowScreenShare);
  const isPreviewVisible = !isExisting || status === 'streaming';

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureWorkerRef = useRef<Worker | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveSessionIdRef = useRef<string | null>(null);
  const frameQueueRef = useRef<Blob[]>([]);
  const inFlightRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const pausedUntilRef = useRef(0);
  // 송출을 시작한 뒤 첫 업로드가 성공하면 목록을 한 번 갱신한다(카드 '연결하는 중' → '연결됨')
  const refreshOnFirstUploadRef = useRef(false);
  // 권한 프롬프트·재시작 중 중복 실행 방지(state 는 비동기라 같은 틱의 두 번째 호출을 못 막는다)
  const startingRef = useRef(false);
  const failCountRef = useRef(0);
  const failSinceRef = useRef<number | null>(null);
  const onUnstableChangeRef = useRef(onUnstableChange);
  onUnstableChangeRef.current = onUnstableChange;
  const onStartingChangeRef = useRef(onStartingChange);
  onStartingChangeRef.current = onStartingChange;
  const onStreamingChangeRef = useRef(onStreamingChange);
  onStreamingChangeRef.current = onStreamingChange;

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
    clearLegacyRotation();
    // 페이지의 '카메라 켜기'가 모달을 열지 않고 시작해도 마지막에 쓴 방식으로 켜지게 한다
    setFacing(getStoredFacing());
    setAllowScreenShare(new URLSearchParams(window.location.search).get('screen') === '1');
  }, []);

  useEffect(() => {
    onStreamingChangeRef.current?.(status === 'streaming');
  }, [status]);

  // 영상 크기는 권한을 받은 뒤·기기를 돌릴 때 바뀐다 - 그때마다 세로 여부를 다시 본다
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => setIsPortrait(isPortraitFrame(video.videoWidth, video.videoHeight));
    video.addEventListener('loadedmetadata', update);
    video.addEventListener('resize', update);
    return () => {
      video.removeEventListener('loadedmetadata', update);
      video.removeEventListener('resize', update);
    };
  }, []);

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
    refreshOnFirstUploadRef.current = false;
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
        .then(() => {
          resetUploadHealth();
          if (refreshOnFirstUploadRef.current) {
            refreshOnFirstUploadRef.current = false;
            void queryClient.invalidateQueries({ queryKey: wardLiveCamerasQueryKey });
          }
        })
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

    // 찍힌 그대로 보낸다(회전 없음). 가로가 1280을 넘을 때만 비율대로 줄인다
    const { width, height } = getCaptureSize(video.videoWidth, video.videoHeight);
    const context = canvas.getContext('2d');
    if (!context) return false;

    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);
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
    setStatus('streaming');
    startCaptureLoop(camera.recommendedFps);
    void requestScreenWakeLock();
    // 방금 켠 상태가 바로 보이도록 15초 폴링을 기다리지 않고 한 번 갱신한다(등록·켜기 공통).
    // 첫 영상이 올라가기 전에 물으면 아직 'running'이 아니라서, 첫 업로드 성공 직후로 미룬다(호출 수는 그대로 1회)
    refreshOnFirstUploadRef.current = true;
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

  const turnOffCamera = async () => {
    if (status === 'off' && !mediaStreamRef.current) return;
    await handleStopMedia();
  };

  useImperativeHandle(ref, () => ({ turnOn: turnOnCamera, turnOff: turnOffCamera }));

  useEffect(() => {
    onStartingChangeRef.current?.(isStartingStream);
  }, [isStartingStream]);

  // '등록하고 촬영 시작': 등록 → 송출 시작 → 창 닫기(확인은 카드의 '카메라 화면 보기'로 한다).
  // 송출 시작이 실패하면 창을 닫지 않고 그 자리에서 다시 시작하게 안내한다.
  const handleRegister = async () => {
    if (!room || registerMutation.isPending || isStartingStream || isRegistering) return;
    setErrorMessage('');

    if (initialRoom && room === initialRoom) {
      const failure = await restartExistingCamera();
      if (failure) setErrorMessage(failure);
      else onClose();
      return;
    }

    setIsRegistering(true);
    const result = await registerAndStart({
      register: () => registerMutation.mutateAsync({ label: room, deviceId: getStoredDeviceId() }),
      onRegistered: camera => setStoredDeviceId(camera.deviceId),
      start: startStreaming,
      onStarted: onClose,
    });
    setIsRegistering(false);

    if (result.kind === 'startFailed') {
      setErrorMessage(START_AFTER_REGISTER_FAILED_MESSAGE);
      return;
    }
    if (result.kind !== 'registerFailed') return;
    // 그 사이 다른 기기가 같은 방을 먼저 등록했을 수 있다 — 방 목록을 새로 받아서 바로잡는다
    if (getErrorCode(result.error) === 'CAMERA_LABEL_DUPLICATED') {
      void refetchRooms();
      setRoom('');
      setErrorMessage('방금 다른 기기에서 그 방을 등록했어요. 다른 방을 골라 주세요.');
      return;
    }
    setErrorMessage(getErrorMessage(result.error, '카메라 등록에 실패했습니다. 다시 시도해 주세요.'));
  };

  // 화면 보기의 '카메라 끄기' - 송출을 끄고 창도 닫는다(카드가 '카메라 켜기'로 바뀐다)
  const handleViewStop = async () => {
    await handleStopMedia();
    onClose();
  };

  // 모달 안의 '카메라 켜기' - 실패 사유는 모달 오류 영역에 보인다
  const handleTurnOn = () => {
    void turnOnCamera().then(failure => failure && failure !== ALREADY_STREAMING && setErrorMessage(failure));
  };

  const title = getModalTitle(initialRoom, status === 'streaming');
  const viewBadge = isViewOnly ? getCardStatus({ status: connectionStatus, isThisDevice: true, isConnecting }) : null;
  const isRegisterBusy = registerMutation.isPending || isStartingStream || isRegistering;

  return (
    <div className={cx('overlay', { hidden: !isOpen })} role="presentation" aria-hidden={!isOpen} onClick={handleClose}>
      <div
        className={cx('modal')}
        role="dialog"
        aria-modal={isOpen || undefined}
        aria-label={title}
        inert={!isOpen}
        onClick={event => event.stopPropagation()}
      >
        <header className={cx('header')}>
          <strong>
            <Icon name="camera" size={26} decorative />
            {title}
          </strong>
          {viewBadge && (
            <span className={cx('statusBadge', viewBadge.tone)}>
              <span className={cx('statusDot')} />
              {viewBadge.label}
            </span>
          )}
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

          {!isViewOnly && <section className={cx('setupSection')}>
            <h2>{isExisting ? '촬영 방식' : '3. 촬영 방식을 골라 주세요'}</h2>
            <div className={cx('facingRow')}>
              {FACING_OPTIONS.filter(option => visibleFacings.includes(option.value)).map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={cx('facingChip', { active: facing === option.value })}
                  onClick={() => {
                    setFacing(option.value);
                    setStoredFacing(option.value);
                  }}
                  disabled={status !== 'off'}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {status === 'streaming' && (
              <p className={cx('previewHint')}>촬영 방식을 바꾸려면 카메라를 끄고 다시 켜 주세요.</p>
            )}
          </section>}

          <section className={cx('setupSection')}>
            {!isViewOnly && <h2>{isExisting ? '지금 찍고 있는 화면' : '4. 지금 찍고 있는 화면을 확인해 주세요'}</h2>}
            {/* 캔버스는 송출용 toBlob 원본이라 접어도 DOM에 남긴다(높이만 0) */}
            <div className={cx('previewBox', { collapsed: !isPreviewVisible })} aria-hidden={!isPreviewVisible}>
              <video ref={videoRef} className={cx('sourceVideo')} autoPlay muted playsInline />
              <canvas ref={canvasRef} className={cx('canvas')} />
              {status !== 'off' && (
                <span className={cx('liveBadge', { live: status === 'streaming' })}>
                  {status === 'streaming' ? '지금 촬영 중' : '미리보기'}
                </span>
              )}
            </div>
            {isViewOnly && <p className={cx('previewHint')}>{VIEW_GUARDIAN_NOTICE}</p>}
            {status !== 'off' && facing !== 'screen' && isPortrait && (
              <p className={cx('rotateHint')}>{AUTO_ROTATE_HINT}</p>
            )}
            {isPreviewVisible && !isViewOnly && (
              <p className={cx('previewHint')}>방 전체가 보이고 사람이 똑바로 보이도록 폰 위치와 방향을 맞춰 주세요.</p>
            )}
            {isExisting && status === 'off' && isCameraRunning && (
              <p className={cx('previewHint')}>
                이 화면에서는 아직 송출하고 있지 않아요. &quot;카메라 켜기&quot;를 누르면 이어서 보내요.
              </p>
            )}
            {status === 'streaming' && isUnstable && (
              <p className={cx('error')}>송출이 끊기고 있어요. 화면을 켜 둔 채 잠시 기다려 주세요. 연결되면 자동으로 이어집니다.</p>
            )}
            <div className={cx('previewControls')}>
              {isViewOnly ? (
                <>
                  <button type="button" className={cx('previewButton', 'stop')} onClick={handleViewStop}>
                    카메라 끄기
                  </button>
                  <button type="button" className={cx('previewButton')} onClick={handleClose}>
                    닫기
                  </button>
                </>
              ) : status === 'off' ? (
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
                <button
                  type="button"
                  className={cx('previewButton', 'stop')}
                  disabled={isRegisterBusy}
                  onClick={handleStopMedia}
                >
                  <Icon name="camera" size={20} decorative />
                  {status === 'streaming' ? '카메라 끄기' : '미리보기 끄기'}
                </button>
              )}
            </div>
          </section>

          {status === 'ready' && (
            <button
              type="button"
              className={cx('registerButton')}
              disabled={!room || isRegisterBusy}
              onClick={() => void handleRegister()}
            >
              {isRegisterBusy
                ? '송출 시작 중...'
                : initialRoom && room === initialRoom
                  ? '촬영 다시 시작'
                  : '등록하고 촬영 시작'}
            </button>
          )}

          {errorMessage && <p className={cx('error')}>{errorMessage}</p>}
        </div>
      </div>
    </div>
  );
}
