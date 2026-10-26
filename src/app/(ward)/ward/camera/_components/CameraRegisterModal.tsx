'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { createStreamSession, stopStreamSession, uploadFrame } from '@/service/api/streamSession';
import { getWardCameras } from '@/service/api/ward/camera';
import { Icon } from '@/components/Icon';
import { getHttpStatus, getRetryAfterMs } from '@/lib/api/streamClient';
import { CAPTURE_LEVELS, decideCaptureLevel, nextUpHoldMs, updateEwma, BASE_UP_HOLD_MS } from './captureQuality';
import {
  canRecreateSession,
  getRecreateBackoffMs,
  isSessionNotFound,
  isSurveillanceLost,
  isUploadUnstable,
} from './streamRecovery';
import { getStoredDeviceId, setStoredDeviceId } from '@/lib/device/deviceId';
import { showToast } from '@/store/toastStore';
import {
  useRegisterWardCameraMutation,
  wardCameraRoomsQueryOptions,
  wardLiveCamerasQueryKey,
} from '@/service/query/ward/camera';
import { WardCamera, type WardCameraConnectionStatus } from '@/service/interface/ward/camera';
import {
  ALREADY_STREAMING,
  FACING_CHOICES,
  REGISTER_STEPS,
  canGoNextStep,
  isMobileCameraDevice,
  isSourceFresh,
  shouldRecoverCamera,
  getCaptureSize,
  getCardStatus,
  getFacingLabel,
  getModalTitle,
  isPortraitFrame,
  parseStoredFacing,
  type CameraFacing,
  type RegisterStep,
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
// 한 장 업로드가 이 시간 안에 끝나지 않으면 끊는다(정상은 0.1~0.5초, 막힌 연결은 수십 초 걸려 두 자리를 계속 차지했다)
const UPLOAD_TIMEOUT_MS = 5000;
const STOP_DRAIN_TIMEOUT_MS = 3000;
// 연속 업로드 실패가 이 횟수 또는 시간을 넘으면 사용자에게 알린다
const MEDIA_PERMISSION_MESSAGE = '카메라를 켜지 못했어요. 브라우저의 카메라 권한을 확인해 주세요.';
const RESTART_FAILED_MESSAGE = '카메라를 켜지 못했어요. 잠시 후 다시 시도해 주세요.';
// 미리보기 중 화면 공유를 '공유 중지'로 끊었거나 카메라가 꺼졌을 때(송출 전이라 송출 루프가 알아채지 못한다)
const PREVIEW_ENDED_MESSAGE = '미리보기가 끊겼어요. 다시 켜 주세요.';
const CAMERA_STOPPED_MESSAGE = '카메라가 멈춰서 촬영을 껐어요. "카메라 켜기"를 눌러 다시 시작해 주세요.';

function getCameraConstraints(facing: Exclude<CameraFacing, 'screen'>): MediaStreamConstraints {
  return {
    video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 } },
    audio: false,
  };
}
// 서비스 전체 카메라 등록 상한(409 CAMERA_LIMIT_REACHED) - 서버 문구 대신 할 일을 알려 준다
const CAMERA_LIMIT_MESSAGE = '지금은 카메라를 더 등록할 수 없어요. 쓰지 않는 카메라를 등록 해제한 뒤 다시 시도해 주세요.';
const START_AFTER_REGISTER_FAILED_MESSAGE = '카메라는 등록됐지만 촬영을 시작하지 못했어요. 아래 버튼을 눌러 다시 시작해 주세요.';

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
  onSurveillanceLostChange,
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
  // 업로드가 30초 넘게 실패하면 true(복구되면 false) - '다시 연결 중입니다' 안내용
  onSurveillanceLostChange?: (lost: boolean) => void;
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
  const [isSurveillanceLostState, setIsSurveillanceLostState] = useState(false);
  // 지금 카메라 영상이 세로인지(자동 회전 안내용)
  const [isPortrait, setIsPortrait] = useState(false);
  // 이미 카메라가 있으면 설정 단계를 줄이고 전송 화면은 기본으로 접는다. 새로 등록할 때는 확인이 필요해 펼친다.
  // 등록하는 동안에는 화면을 고정한다 - 등록 직후 목록이 갱신돼 initialRoom 이 먼저 채워져도
  // 창이 닫히기 전에 '카메라 켜기' 화면으로 잠깐 바뀌지 않게
  const [isRegistering, setIsRegistering] = useState(false);
  const isExisting = Boolean(initialRoom) && !isRegistering;
  // 기존 카메라는 송출 중일 때 전송 화면만 보여 준다(촬영 방식은 끄면 다시 고를 수 있다)
  const isViewOnly = isExisting && status === 'streaming';
  // 새 등록은 4단계 마법사(방 → 기기 놓기 → 촬영 방식 → 미리보기). 촬영 방식은 3단계에서 직접 골라야 넘어간다
  const [wizardStep, setWizardStep] = useState<RegisterStep>(1);
  const [facingChosen, setFacingChosen] = useState(false);
  const isWizard = !isExisting;
  // 영상 상자는 송출 원본(video·canvas)이라 하나만 두고 보일 때만 펼친다
  const isPreviewVisible = isWizard ? wizardStep === 4 : status !== 'off';

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
  // 카메라가 새 프레임을 주는지 보는 값들(멈춘 장면을 보내지 않고, 폰을 다시 켜면 카메라를 다시 켠다)
  const facingRef = useRef<CameraFacing>(facing);
  facingRef.current = facing;
  // 지금 4단계 미리보기를 보여 주는 중인지 - 화면 선택·권한 창이 늦게 끝났을 때 그 결과를 쓸지 판단한다
  const wantsPreviewRef = useRef(false);
  wantsPreviewRef.current = isOpen && isWizard && wizardStep === 4;
  const staleSinceRef = useRef<number | null>(null);
  const recoveringRef = useRef(false);
  const lastRecoverAtRef = useRef(0);
  // 송출을 시작한 뒤 첫 업로드가 성공하면 목록을 한 번 갱신한다(카드 '연결하는 중' → '연결됨')
  const refreshOnFirstUploadRef = useRef(false);
  // 권한 프롬프트·재시작 중 중복 실행 방지(state 는 비동기라 같은 틱의 두 번째 호출을 못 막는다)
  const startingRef = useRef(false);
  // 미리보기 카메라·화면 선택 창이 떠 있는 동안 true - 버튼 문구용이라 ref 가 아니라 state 로 둔다
  const [isMediaStarting, setIsMediaStarting] = useState(false);
  // 4단계에서 미리보기를 한 번이라도 켜 봤는지 - 시도 전(첫 화면)에는 '다시 켜기'를 보이지 않는다
  const [isMediaTried, setIsMediaTried] = useState(false);
  const failSinceRef = useRef<number | null>(null);
  const onUnstableChangeRef = useRef(onUnstableChange);
  onUnstableChangeRef.current = onUnstableChange;
  const onSurveillanceLostChangeRef = useRef(onSurveillanceLostChange);
  onSurveillanceLostChangeRef.current = onSurveillanceLostChange;
  // 세션 자동 복구: 송출 중인 카메라 정보, 진행 중 플래그(동시 404 중복 호출 방지), 다음 시도 허용 시각, 연속 시도 횟수
  const streamCameraRef = useRef<WardCamera | null>(null);
  const recreatingRef = useRef(false);
  // 송출 화질 자동 조절(captureQuality.ts) - 업로드가 느려지면 해상도·품질을 단계적으로 낮춘다
  const captureLevelRef = useRef(0);
  const uploadEwmaRef = useRef<number | null>(null);
  const uploadSamplesRef = useRef(0);
  const levelChangedAtRef = useRef(0);
  const levelUpAtRef = useRef(0);
  const upHoldRef = useRef(BASE_UP_HOLD_MS);
  const inFlightStartsRef = useRef<number[]>([]);
  // [임시 진단] 송출 단계별 통계 - 5초마다 한 줄로 남긴다(토큰·세션 ID·영상 내용 없음)
  const captureStatsRef = useRef({
    startedAt: 0, ticks: 0, stale: 0, drawFail: 0, blobNull: 0, queued: 0, overwritten: 0,
    upStarted: 0, upOk: 0, upFail: 0, sumMs: 0, maxMs: 0, sumBytes: 0,
  });
  const nextRecreateAtRef = useRef(0);
  const recreateAttemptRef = useRef(0);
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
  }, []);

  useEffect(() => {
    onStreamingChangeRef.current?.(status === 'streaming');
  }, [status]);

  // 새 등록 창을 열 때마다 1단계부터 시작한다(방·촬영 방식은 다시 고른다)
  useEffect(() => {
    if (!isOpen || isExisting || status !== 'off') return;
    setWizardStep(1);
    setFacingChosen(false);
    setRoom('');
    setErrorMessage('');
    // 창을 열 때만 초기화한다 - 단계 이동 중 상태 변화로 다시 돌지 않게
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 4단계(미리보기)에 들어가면 고른 방식으로 카메라를 켠다. 실패하면 자동으로 다시 시도하지 않는다(권한 창 반복 방지)
  const autoPreviewTriedRef = useRef(false);
  useEffect(() => {
    if (!isOpen || !isWizard || wizardStep !== 4) {
      autoPreviewTriedRef.current = false;
      setIsMediaTried(false);
      return;
    }
    // 이전 단계로 갔다 온 사이 지난번 켜기가 아직 끝나지 않았으면, 끝난 뒤(결과를 쓰거나 버린 뒤) 다시 본다
    if (status !== 'off' || autoPreviewTriedRef.current || isMediaStarting) return;
    autoPreviewTriedRef.current = true;
    void handleStartMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isWizard, wizardStep, status, isMediaStarting]);

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
      if (document.visibilityState !== 'visible' || !liveSessionIdRef.current) return;
      void requestScreenWakeLock();
      // 화면이 꺼진 동안 브라우저가 멈춘 영상을 다시 재생한다(카메라가 끊겼으면 송출 루프가 다시 켠다)
      const video = videoRef.current;
      if (video?.paused) void video.play().catch(() => {});
    };

    document.addEventListener('visibilitychange', requestWakeLockWhenVisible);
    return () => document.removeEventListener('visibilitychange', requestWakeLockWhenVisible);
  }, []);

  const isCaptureSourceFresh = () => {
    const track = mediaStreamRef.current?.getVideoTracks()[0];
    return isSourceFresh({
      isScreen: facingRef.current === 'screen',
      visible: document.visibilityState === 'visible',
      hiddenStopsCamera: isMobileCameraDevice(navigator.userAgent, navigator.maxTouchPoints),
      trackLive: track?.readyState === 'live',
      trackMuted: Boolean(track?.muted),
      videoPaused: Boolean(videoRef.current?.paused),
    });
  };

  // 카메라가 멈췄다(폰 화면 꺼짐·다른 앱이 카메라를 가져감 등) - 영상을 다시 재생해 보고, 안 되면 같은 방식으로
  // 카메라를 다시 켜 같은 송출 세션으로 이어 보낸다. 다시 켜지 못하면 송출을 완전히 꺼서 '카메라 켜기'로 돌아가게 한다.
  const recoverCamera = async () => {
    const facingNow = facingRef.current;
    if (facingNow === 'screen') return;
    recoveringRef.current = true;
    lastRecoverAtRef.current = Date.now();
    try {
      const video = videoRef.current;
      const track = mediaStreamRef.current?.getVideoTracks()[0];
      if (video && video.paused && track?.readyState === 'live' && !track.muted) {
        await video.play().catch(() => {});
        return;   // 다음 송출 틱이 다시 판단한다 - 재생만으로 살아나지 않으면 쿨다운 뒤 카메라를 다시 켠다
      }
      const stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints(facingNow));
      if (!liveSessionIdRef.current) {
        stream.getTracks().forEach(item => item.stop());   // 그 사이 송출이 꺼졌다
        return;
      }
      mediaStreamRef.current?.getTracks().forEach(item => item.stop());
      mediaStreamRef.current = stream;
      staleSinceRef.current = null;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
    } catch {
      if (liveSessionIdRef.current) {
        await handleStopMedia();
        showToast(CAMERA_STOPPED_MESSAGE, { variant: 'error' });
      }
    } finally {
      recoveringRef.current = false;
    }
  };

  const handleStaleSource = () => {
    const now = Date.now();
    staleSinceRef.current ??= now;
    const isScreen = facingRef.current === 'screen';
    // 화면 공유를 브라우저에서 '공유 중지'로 끊었으면 다시 켤 수 없으니 송출을 끈다
    if (isScreen && mediaStreamRef.current?.getVideoTracks()[0]?.readyState !== 'live') {
      void handleStopMedia().then(() => showToast(CAMERA_STOPPED_MESSAGE, { variant: 'error' }));
      return;
    }
    if (
      shouldRecoverCamera({
        isScreen,
        visible: document.visibilityState === 'visible',
        staleForMs: now - staleSinceRef.current,
        msSinceLastRecover: now - lastRecoverAtRef.current,
        recovering: recoveringRef.current,
      })
    ) {
      void recoverCamera();
    }
  };

  // 카메라·화면 권한을 받아 미리보기 루프까지 시작한다. 실패하면 false.
  const openMedia = async (): Promise<boolean> => {
    // 이전 스트림이 남아 있으면(중복 호출 등) 참조를 덮어쓰기 전에 트랙을 먼저 끈다
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    try {
      const stream =
        facing === 'screen'
          ? await navigator.mediaDevices.getDisplayMedia({ video: true })
          : await navigator.mediaDevices.getUserMedia(getCameraConstraints(facing));

      mediaStreamRef.current = stream;
      // 미리보기 중 트랙이 끝나면(공유 중지·카메라 분리) 미리보기를 끄고 다시 켜게 안내한다. 송출 중이면 송출 루프가 맡는다
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (mediaStreamRef.current !== stream || liveSessionIdRef.current) return;
        void handleStopMedia();
        setErrorMessage(PREVIEW_ENDED_MESSAGE);
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // 자동 재생에만 맡기지 않고 직접 시작한다(재생이 멈춰 있으면 송출 루프가 멈춘 장면으로 보고 보내지 않는다)
        void videoRef.current.play().catch(() => {});
      }
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
    setIsMediaStarting(true);
    setIsMediaTried(true);
    setErrorMessage('');
    const requestedFacing = facingRef.current;
    try {
      const opened = await openMedia();
      // 화면 선택·권한 창이 떠 있는 동안 창을 닫았거나 이전 단계로 갔거나 촬영 방식을 바꿨으면 결과를 버린다
      // (그대로 두면 숨은 창에서 카메라·화면 공유가 켜진 채 남고, 다시 열면 4단계가 보였다)
      const isStale = !wantsPreviewRef.current || facingRef.current !== requestedFacing;
      if (opened && isStale) await handleStopMedia();
      else if (!opened && !isStale) setErrorMessage(MEDIA_PERMISSION_MESSAGE);
    } finally {
      startingRef.current = false;
      setIsMediaStarting(false);
    }
  };

  // 부모에게 알리는 일은 아래 effect 가 한다 - setState 업데이터 안에서 부모 setState 를 부르면
  // '다른 컴포넌트를 그리는 중 상태를 바꿨다'는 React 경고(개발 화면의 1 Issue)가 났다
  const updateUnstable = (unstable: boolean) => setIsUnstable(unstable);
  const updateSurveillanceLost = (lost: boolean) => setIsSurveillanceLostState(lost);

  // AI 서버 재시작 등으로 세션이 사라졌을 때 같은 카메라 정보로 세션을 다시 만든다(사용자 조작 없이).
  // 송출을 끈 뒤에는 하지 않고, 만드는 사이 껐다면 되살아난 세션을 바로 중지한다.
  const recreateSession = async (sessionId: string) => {
    const camera = streamCameraRef.current;
    const now = Date.now();
    if (
      !camera ||
      !canRecreateSession({
        now,
        nextAllowedAt: nextRecreateAtRef.current,
        recreating: recreatingRef.current,
        isStillStreaming: liveSessionIdRef.current === sessionId,
      })
    ) {
      return;
    }
    recreatingRef.current = true;
    nextRecreateAtRef.current = now + getRecreateBackoffMs(recreateAttemptRef.current);
    recreateAttemptRef.current += 1;
    try {
      await createStreamSession({ sessionId: camera.sessionId, cameraIdentifier: camera.deviceId, deviceType: 'web' });
      if (liveSessionIdRef.current === null) await stopStreamSession(sessionId).catch(() => {});
      else console.info('[stream] 송출 세션을 다시 만들었습니다.');
    } catch (error) {
      console.warn('[stream] 송출 세션 재생성 실패', getHttpStatus(error) ?? 'network');
    } finally {
      recreatingRef.current = false;
    }
  };

  const resetUploadHealth = () => {
    pausedUntilRef.current = 0;
    failSinceRef.current = null;
    recreateAttemptRef.current = 0;
    nextRecreateAtRef.current = 0;
    updateUnstable(false);
    updateSurveillanceLost(false);
  };

  const handleUploadFailure = (error: unknown, sessionId: string) => {
    // 429: 서버가 쉬라고 한 시간만큼 업로드를 멈춘다(새 프레임은 계속 최신으로 덮어쓴다)
    if (getHttpStatus(error) === 429) pausedUntilRef.current = Date.now() + getRetryAfterMs(error);

    const now = Date.now();
    failSinceRef.current ??= now;
    if (isUploadUnstable(failSinceRef.current, now)) updateUnstable(true);
    if (isSurveillanceLost(failSinceRef.current, now)) updateSurveillanceLost(true);
    if (isSessionNotFound(error)) void recreateSession(sessionId);
  };

  // 업로드 중인 프레임이 끝나기를 기다린다(최대 STOP_DRAIN_TIMEOUT_MS - 업로드가 멈춰 있어도 끄기는 진행한다)
  const waitForInFlightUploads = async () => {
    const deadline = Date.now() + STOP_DRAIN_TIMEOUT_MS;
    while (inFlightRef.current > 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  };

  const handleStopMedia = async () => {
    resetUploadHealth();
    refreshOnFirstUploadRef.current = false;
    staleSinceRef.current = null;
    const sessionId = liveSessionIdRef.current;
    liveSessionIdRef.current = null;
    streamCameraRef.current = null;
    captureWorkerRef.current?.terminate();
    captureWorkerRef.current = null;
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    frameQueueRef.current = [];
    // 화면(카메라·꺼짐 표시)은 바로 끈다 - 아래 마무리를 기다리는 몇 초 동안 '송출 중'으로 남아, 등록 해제 직후
    // 등록 창을 열면 회전 안내가 모든 단계에 뜨고 촬영 방식이 잠겼다(2026-10-15)
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('off');
    void releaseScreenWakeLock();
    // 보내던 프레임이 다 끝난 뒤에 중지한다 - 중지 뒤에 늦게 도착한 프레임이 AI 세션을 '송출 중'으로 되살려
    // 끈 카메라가 보호자·피보호자 화면에 계속 '켜짐'으로 남았다(2026-10-15 gosky)
    await waitForInFlightUploads();
    // 기다리는 사이 같은 카메라로 다시 켰으면 중지하지 않는다(새로 켠 송출을 끄게 된다)
    if (sessionId && liveSessionIdRef.current !== sessionId) await stopStreamSession(sessionId).catch(() => {});
    // 끈 상태가 15초 폴링을 기다리지 않고 바로 보이게 한다
    void queryClient.invalidateQueries({ queryKey: wardLiveCamerasQueryKey });
  };

  // 모달을 닫아도 송출(streaming)은 유지한다. 이 컴포넌트는 숨긴 채로 남아
  // video/canvas ref와 송출 세션이 끊기지 않도록 WardCameraContent에서 계속 마운트한다.
  // 다만 등록 전 미리보기(ready)는 보내는 것이 없으니 닫을 때 카메라를 끈다.
  const handleClose = () => {
    if (status === 'ready' && !isRegistering) void handleStopMedia();
    onClose();
  };

  // 업로드 속도에 맞춰 화질 단계를 정한다(바뀌면 지난 표본은 버리고 새 화질의 결과를 다시 본다)
  const evaluateCaptureLevel = () => {
    const now = Date.now();
    const oldest = inFlightStartsRef.current.length > 0 ? now - Math.min(...inFlightStartsRef.current) : 0;
    const previous = captureLevelRef.current;
    const next = decideCaptureLevel({
      level: previous,
      ewmaMs: uploadEwmaRef.current,
      samples: uploadSamplesRef.current,
      oldestInFlightMs: oldest,
      now,
      lastChangeAt: levelChangedAtRef.current,
      upHoldMs: upHoldRef.current,
    });
    if (next === previous) return;
    const wentDown = next > previous;
    if (wentDown) upHoldRef.current = nextUpHoldMs(upHoldRef.current, true, now - levelUpAtRef.current);
    else levelUpAtRef.current = now;
    console.info(
      '[capture] 화질 단계 변경',
      `${previous}->${next} (${CAPTURE_LEVELS[next].maxWidth}px q${CAPTURE_LEVELS[next].quality})`,
      `ewmaMs=${Math.round(uploadEwmaRef.current ?? 0)} oldestInFlightMs=${oldest}`,
    );
    captureLevelRef.current = next;
    levelChangedAtRef.current = now;
    uploadEwmaRef.current = null;
    uploadSamplesRef.current = 0;
  };

  const flushCaptureStats = (force: boolean) => {
    const stats = captureStatsRef.current;
    const now = Date.now();
    if (!stats.startedAt) stats.startedAt = now;
    if (!force && now - stats.startedAt < 5000) return;
    const done = stats.upOk + stats.upFail;
    const video = videoRef.current;
    const track = mediaStreamRef.current?.getVideoTracks()[0];
    const connection = (navigator as Navigator & { connection?: { rtt?: number; downlink?: number } }).connection;
    console.info(
      '[capture]',
      `ticks=${stats.ticks} stale=${stats.stale} drawFail=${stats.drawFail} blobNull=${stats.blobNull}`,
      `queued=${stats.queued} overwritten=${stats.overwritten}`,
      `up=${stats.upOk}ok/${stats.upFail}fail started=${stats.upStarted} inflight=${inFlightRef.current}`,
      `avgMs=${done ? Math.round(stats.sumMs / done) : 0} maxMs=${stats.maxMs} avgKB=${stats.upStarted ? Math.round(stats.sumBytes / stats.upStarted / 1024) : 0}`,
      `vis=${document.visibilityState} paused=${Boolean(video?.paused)} ready=${video?.readyState ?? -1} size=${video?.videoWidth ?? 0}x${video?.videoHeight ?? 0}`,
      `lvl=${captureLevelRef.current}`,
      `track=${track?.readyState ?? 'none'}${track?.muted ? '/muted' : ''} paused429=${Date.now() < pausedUntilRef.current}`,
      `rtt=${connection?.rtt ?? '-'} downlink=${connection?.downlink ?? '-'}`,
    );
    captureStatsRef.current = {
      startedAt: now, ticks: 0, stale: 0, drawFail: 0, blobNull: 0, queued: 0, overwritten: 0,
      upStarted: 0, upOk: 0, upFail: 0, sumMs: 0, maxMs: 0, sumBytes: 0,
    };
  };

  const enqueueLatestFrame = (blob: Blob) => {
    if (!liveSessionIdRef.current) return;
    captureStatsRef.current.queued += 1;
    if (frameQueueRef.current.length > 0) captureStatsRef.current.overwritten += 1;
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
      const uploadStartedAt = Date.now();
      inFlightStartsRef.current.push(uploadStartedAt);
      const stats = captureStatsRef.current;
      stats.upStarted += 1;
      stats.sumBytes += blob.size;
      const finishUpload = (ok: boolean) => {
        const elapsed = Date.now() - uploadStartedAt;
        const startIndex = inFlightStartsRef.current.indexOf(uploadStartedAt);
        if (startIndex >= 0) inFlightStartsRef.current.splice(startIndex, 1);
        if (ok) {
          uploadEwmaRef.current = updateEwma(uploadEwmaRef.current, elapsed);
          uploadSamplesRef.current += 1;
        }
        if (ok) stats.upOk += 1;
        else stats.upFail += 1;
        stats.sumMs += elapsed;
        stats.maxMs = Math.max(stats.maxMs, elapsed);
      };
      void uploadFrame(sessionId, blob, UPLOAD_TIMEOUT_MS)
        .then(() => {
          finishUpload(true);
          resetUploadHealth();
          if (refreshOnFirstUploadRef.current) {
            refreshOnFirstUploadRef.current = false;
            void queryClient.invalidateQueries({ queryKey: wardLiveCamerasQueryKey });
          }
        })
        .catch(error => {
          finishUpload(false);
          handleUploadFailure(error, sessionId);
        })
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
    const { width, height } = getCaptureSize(video.videoWidth, video.videoHeight, CAPTURE_LEVELS[captureLevelRef.current].maxWidth);
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
        flushCaptureStats(false);
        evaluateCaptureLevel();
        captureStatsRef.current.ticks += 1;
        // 카메라가 새 프레임을 주지 않으면 보내지 않는다(멈춘 장면을 '연결됨'으로 계속 보내지 않게)
        if (!isCaptureSourceFresh()) {
          captureStatsRef.current.stale += 1;
          handleStaleSource();
          return;
        }
        staleSinceRef.current = null;
        if (!drawFrameToCanvas()) {
          captureStatsRef.current.drawFail += 1;
          return;
        }
        canvasRef.current?.toBlob(
          blob => {
            if (!blob) captureStatsRef.current.blobNull += 1;
            else enqueueLatestFrame(blob);
          },
          'image/jpeg',
          CAPTURE_LEVELS[captureLevelRef.current].quality,
        );
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
    captureLevelRef.current = 0;
    uploadEwmaRef.current = null;
    uploadSamplesRef.current = 0;
    levelChangedAtRef.current = 0;
    upHoldRef.current = BASE_UP_HOLD_MS;
    inFlightStartsRef.current = [];
    liveSessionIdRef.current = session.session_id ?? camera.sessionId;
    streamCameraRef.current = camera;
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
    onUnstableChangeRef.current?.(isUnstable);
  }, [isUnstable]);

  useEffect(() => {
    onSurveillanceLostChangeRef.current?.(isSurveillanceLostState);
  }, [isSurveillanceLostState]);

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
      // 방을 다시 골라야 하므로 미리보기를 끄고 1단계로 돌아간다(4단계에 남으면 방이 비어 버튼을 누를 수 없다)
      if (status === 'ready') void handleStopMedia();
      setWizardStep(1);
      setErrorMessage('방금 다른 기기에서 그 방을 등록했어요. 다른 방을 골라 주세요.');
      return;
    }
    if (getErrorCode(result.error) === 'CAMERA_LIMIT_REACHED') {
      setErrorMessage(CAMERA_LIMIT_MESSAGE);
      return;
    }
    setErrorMessage(getErrorMessage(result.error, '카메라 등록에 실패했습니다. 다시 시도해 주세요.'));
  };

  // 화면 보기의 '카메라 끄기' - 송출을 끄고 창도 닫는다(카드가 '카메라 켜기'로 바뀐다)
  const handleViewStop = async () => {
    onClose();   // 먼저 닫는다 - 마무리를 기다리는 동안 '카메라 켜기' 화면이 비치지 않게
    await handleStopMedia();
  };

  // 모달 안의 '카메라 켜기' - 실패 사유는 모달 오류 영역에 보인다
  const handleTurnOn = () => {
    void turnOnCamera().then(failure => failure && failure !== ALREADY_STREAMING && setErrorMessage(failure));
  };

  const title = getModalTitle(initialRoom, status === 'streaming');
  const viewBadge = isViewOnly ? getCardStatus({ status: connectionStatus, isThisDevice: true, isConnecting }) : null;
  const isRegisterBusy = registerMutation.isPending || isStartingStream || isRegistering;
  // 4단계 첫 화면·화면 선택(권한) 창이 떠 있는 동안은 '다시 켜기'가 아니라 켜는 중으로 보인다
  const isPreviewPending = isMediaStarting || (status === 'off' && !isMediaTried);
  // 영상이 보이는 화면(미리보기·화면 보기)에서만 안내한다
  const showRotateHint = isPreviewVisible && status !== 'off' && facing !== 'screen' && isPortrait;

  const chooseFacing = (value: CameraFacing) => {
    setFacing(value);
    setStoredFacing(value);
    setFacingChosen(true);
  };

  // 4단계에서 '이전' - 켜 둔 미리보기 카메라를 끄고 촬영 방식으로 돌아간다
  const handleWizardBack = () => {
    setErrorMessage('');
    if (wizardStep === 4 && status === 'ready') void handleStopMedia();
    setWizardStep(step => (step > 1 ? ((step - 1) as RegisterStep) : step));
  };

  const handleWizardNext = () => {
    if (!canGoNextStep(wizardStep, { room, facingChosen })) return;
    setErrorMessage('');
    setWizardStep(step => (step < 4 ? ((step + 1) as RegisterStep) : step));
  };

  const facingRadios = (
    <div className={cx('facingList')} role="radiogroup" aria-label="촬영 방식">
      {FACING_CHOICES.map(choice => {
        const checked = (isWizard ? facingChosen : true) && facing === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={checked}
            className={cx('facingCard', { checked })}
            disabled={status !== 'off'}
            onClick={() => chooseFacing(choice.value)}
          >
            <span className={cx('radioMark')} aria-hidden="true" />
            <span className={cx('facingText')}>
              <strong>{choice.label}</strong>
              <span>{choice.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* 송출 원본. 창(숨겨질 수 있음) 밖에 둔다 - 크롬은 보이지 않는 곳의 무음 영상은 자동 재생을 시작하지 않아,
          창을 열지 않고 카드의 '카메라 켜기'로 시작하면 영상이 멈춰 있어 송출되지 않았다(2026-10-15 gosky) */}
      <video ref={videoRef} className={cx('sourceVideo')} autoPlay muted playsInline aria-hidden="true" />
      <div className={cx('overlay', { hidden: !isOpen })} role="presentation" aria-hidden={!isOpen} onClick={handleClose}>
        <div
          className={cx('modal', { wideView: isViewOnly })}
          role="dialog"
          aria-modal={isOpen || undefined}
          aria-label={title}
          inert={!isOpen}
          onClick={event => event.stopPropagation()}
        >
          <header className={cx('header')}>
            <strong>{title}</strong>
            {viewBadge && (
              <span className={cx('statusBadge', viewBadge.tone)}>
                <span className={cx('statusDot')} />
                {viewBadge.label}
              </span>
            )}
            <button type="button" className={cx('closeButton', { boxed: isViewOnly })} onClick={handleClose} aria-label="닫기">
              ×
            </button>
          </header>

          <div className={cx('body')}>
            {isWizard && (
              <ol className={cx('stepper')} aria-label="등록 단계">
                {REGISTER_STEPS.map((label, index) => {
                  const step = index + 1;
                  return (
                    <li
                      key={label}
                      className={cx('stepItem', { done: step < wizardStep, current: step === wizardStep })}
                      aria-current={step === wizardStep ? 'step' : undefined}
                    >
                      <span className={cx('stepBar')} />
                      <span className={cx('stepLabel')}>{`${step}. ${label}`}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {isWizard && wizardStep === 1 && (
              <section className={cx('setupSection')}>
                <h2>어디에 두셨나요?</h2>
                <RoomPicker rooms={rooms} selectedLabel={room} availableRegisteredLabel={initialRoom} onSelect={setRoom} />
              </section>
            )}

            {isWizard && wizardStep === 2 && (
              <section className={cx('setupSection')}>
                <h2>기기를 이렇게 놓아 주세요</h2>
                <div className={cx('cameraGuide')}>
                  <svg className={cx('guideIllustration')} viewBox="0 0 104 80" fill="none" aria-hidden="true">
                    <path d="M8 74H96" stroke="#cfc6bc" strokeWidth="2.5" strokeLinecap="round" />
                    <rect x="26" y="12" width="40" height="54" rx="6" fill="#fff" stroke="var(--sb-brand)" strokeWidth="2.5" transform="rotate(-8 46 39)" />
                    <circle cx="44" cy="20" r="2.4" fill="var(--sb-brand)" transform="rotate(-8 46 39)" />
                    <path d="m56 66 8 8" stroke="var(--sb-brand)" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M62 60q16-2 18 10v4" stroke="#8a827b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <rect x="76" y="66" width="10" height="8" rx="2" fill="#8a827b" />
                  </svg>
                  <p>방 전체가 보이는 곳에 세워 두고, 화면을 켠 채 충전기를 연결해 주세요</p>
                </div>
              </section>
            )}

            {isWizard && wizardStep === 3 && (
              <section className={cx('setupSection')}>
                <h2>어떻게 촬영할까요?</h2>
                {facingRadios}
              </section>
            )}

            {isWizard && wizardStep === 4 && <h2 className={cx('sectionTitle')}>이렇게 보여요</h2>}

            {isExisting && status === 'off' && (
              <section className={cx('setupSection')}>
                <h2>어떻게 촬영할까요?</h2>
                {facingRadios}
                {isCameraRunning && (
                  <p className={cx('previewHint')}>
                    이 화면에서는 아직 송출하고 있지 않아요. &quot;카메라 켜기&quot;를 누르면 이어서 보내요.
                  </p>
                )}
              </section>
            )}

            {/* 캔버스는 송출용 toBlob 원본이라 접어도 DOM에 남긴다(높이만 0) */}
            <div className={cx('previewBox', { collapsed: !isPreviewVisible })} aria-hidden={!isPreviewVisible}>
              <canvas ref={canvasRef} className={cx('canvas')} />
              {status !== 'off' && (
                <span className={cx('liveBadge', { live: status === 'streaming' })}>
                  {status === 'streaming' ? '지금 촬영 중' : '미리보기'}
                </span>
              )}
              {/* 10초 넘게 끊기면 영상을 가리지 않는 작은 표시, 30초를 넘기면 아래 덮개가 대신한다 */}
              {status === 'streaming' && isUnstable && !isSurveillanceLostState && (
                <span className={cx('unstableBadge')} role="status">
                  연결이 불안정해요
                </span>
              )}
              {/* 30초 넘게 끊기면 촬영 화면 위에 크게 알린다(아래쪽 안내는 눈에 잘 띄지 않았다) */}
              {status === 'streaming' && isSurveillanceLostState && (
                <div className={cx('lostOverlay')} role="alert">
                  <span className={cx('lostSpinner')} aria-hidden="true" />
                  <strong>다시 연결 중입니다</strong>
                  <span>화면을 켜 둔 채 잠시 기다려 주세요</span>
                </div>
              )}
            </div>

            {isWizard && wizardStep === 4 && (
              <dl className={cx('summary')}>
                <div>
                  <dt>방</dt>
                  <dd>{room}</dd>
                </div>
                <div>
                  <dt>촬영 방식</dt>
                  <dd>{getFacingLabel(facing)}</dd>
                </div>
              </dl>
            )}

            {showRotateHint && (
              <p className={cx('rotateHint')}>
                <span className={cx('rotateHintIcon')}>
                  <Icon name="refresh" size={18} decorative />
                </span>
                <span>
                  휴대폰을 가로로 두셨는데 화면이 세로로 보이면 휴대폰 설정에서 <strong>&apos;자동 회전&apos;</strong>을 켜 주세요.
                </span>
              </p>
            )}
          </div>

          {/* 스크롤 영역 맨 아래에 두면 영상·요약에 밀려 보이지 않았다(등록 실패가 '반응 없음'으로 보임) - 버튼 바로 위에 둔다 */}
          {errorMessage && (
            <p className={cx('error')} role="alert">
              {errorMessage}
            </p>
          )}

          <footer className={cx('footer')}>
            {isViewOnly ? (
              <>
                <button type="button" className={cx('secondaryButton', 'accent')} onClick={() => void handleViewStop()}>
                  카메라 끄기
                </button>
                <button type="button" className={cx('primaryButton')} onClick={handleClose}>
                  닫기
                </button>
              </>
            ) : isWizard ? (
              <>
                {wizardStep > 1 && (
                  <button type="button" className={cx('secondaryButton')} disabled={isRegisterBusy} onClick={handleWizardBack}>
                    이전
                  </button>
                )}
                {wizardStep < 4 ? (
                  <button
                    type="button"
                    className={cx('primaryButton')}
                    disabled={!canGoNextStep(wizardStep, { room, facingChosen })}
                    onClick={handleWizardNext}
                  >
                    {wizardStep === 2 ? '이렇게 놓았어요' : '다음'}
                  </button>
                ) : isPreviewPending ? (
                  <button type="button" className={cx('primaryButton')} disabled>
                    {facing === 'screen' ? '화면을 고르는 중...' : '카메라를 켜는 중...'}
                  </button>
                ) : status === 'off' ? (
                  <button type="button" className={cx('primaryButton')} onClick={() => void handleStartMedia()}>
                    카메라 다시 켜기
                  </button>
                ) : (
                  <button
                    type="button"
                    className={cx('primaryButton')}
                    disabled={!room || status !== 'ready' || isRegisterBusy}
                    onClick={() => void handleRegister()}
                  >
                    {isRegisterBusy ? '촬영 시작하는 중...' : '등록하고 촬영 시작'}
                  </button>
                )}
              </>
            ) : status === 'off' ? (
              <>
                <button type="button" className={cx('secondaryButton')} onClick={handleClose}>
                  닫기
                </button>
                <button type="button" className={cx('primaryButton')} disabled={isStartingStream} onClick={handleTurnOn}>
                  {isStartingStream ? '카메라 켜는 중...' : '카메라 켜기'}
                </button>
              </>
            ) : (
              <>
                <button type="button" className={cx('secondaryButton')} disabled={isRegisterBusy} onClick={() => void handleStopMedia()}>
                  미리보기 끄기
                </button>
                <button
                  type="button"
                  className={cx('primaryButton')}
                  disabled={!room || isRegisterBusy}
                  onClick={() => void handleRegister()}
                >
                  {isRegisterBusy ? '촬영 시작하는 중...' : '촬영 다시 시작'}
                </button>
              </>
            )}
          </footer>
        </div>
      </div>
    </>
  );
}
