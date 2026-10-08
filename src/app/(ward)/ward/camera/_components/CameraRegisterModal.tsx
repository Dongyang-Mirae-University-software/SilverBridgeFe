'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { createStreamSession, stopStreamSession, uploadFrame } from '@/service/api/streamSession';
import { getWardCameras } from '@/service/api/ward/camera';
import { Icon } from '@/components/Icon';
import { getStoredDeviceId, setStoredDeviceId } from '@/lib/device/deviceId';
import { useRegisterWardCameraMutation, wardCameraRoomsQueryOptions } from '@/service/query/ward/camera';
import { WardCamera } from '@/service/interface/ward/camera';
import { RoomPicker } from './RoomPicker';
import styles from './CameraRegisterModal.module.css';

const cx = classNames.bind(styles);

type CameraFacing = 'user' | 'environment' | 'screen';
type StreamStatus = 'off' | 'ready' | 'streaming';
type FrameRotation = 0 | 90 | 180 | 270;
type WakeLockSentinelLike = { released: boolean; release: () => Promise<void> };

const CAMERA_ROTATION_STORAGE_KEY = 'silverbridge_ward_camera_rotation';
const MAX_IN_FLIGHT = 2;

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

export function CameraRegisterModal({
  initialRoom,
  isCameraRunning = false,
  isOpen,
  onClose,
}: {
  // 이 기기가 쓰던 카메라가 끊겨서 다시 켤 때 — 원래 쓰던 방을 미리 선택해 둔다.
  // 같은 기기·같은 방으로 다시 등록하면 백엔드가 기존 sessionId를 그대로 재사용한다
  initialRoom?: string;
  isCameraRunning?: boolean;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [status, setStatus] = useState<StreamStatus>('off');
  const [room, setRoom] = useState(initialRoom ?? '');
  const [errorMessage, setErrorMessage] = useState('');
  const [registeredCamera, setRegisteredCamera] = useState<WardCamera | null>(null);
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [rotation, setRotation] = useState<FrameRotation>(getStoredRotation);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveSessionIdRef = useRef<string | null>(null);
  const frameQueueRef = useRef<Blob[]>([]);
  const inFlightRef = useRef(0);
  const rotationRef = useRef<FrameRotation>(rotation);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const { data: rooms = [], refetch: refetchRooms } = useQuery(wardCameraRoomsQueryOptions);
  const registerMutation = useRegisterWardCameraMutation();

  // 모달은 송출을 유지하기 위해 항상 마운트돼 있다. 따라서 카메라 목록이 나중에
  // 도착한 경우에도, 다시 열 때 기존 카메라의 방을 등록 대상으로 채워야 한다.
  useEffect(() => {
    if (isOpen && status === 'off' && initialRoom) setRoom(initialRoom);
  }, [initialRoom, isOpen, status]);

  useEffect(() => {
    return () => {
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      void wakeLockRef.current?.release().catch(() => {});
    };
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

  const handleStartMedia = async () => {
    setErrorMessage('');
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
    } catch {
      setErrorMessage('카메라·화면 접근 권한이 필요합니다.');
    }
  };

  const handleStopMedia = async () => {
    const sessionId = liveSessionIdRef.current;
    liveSessionIdRef.current = null;
    if (sessionId) await stopStreamSession(sessionId).catch(() => {});
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
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
  };

  // 모달을 닫아도 카메라와 업로드 루프를 유지한다. 이 컴포넌트는 숨긴 채로 남아
  // video/canvas ref와 송출 세션이 끊기지 않도록 WardCameraContent에서 계속 마운트한다.
  const handleClose = () => onClose();

  const enqueueLatestFrame = (blob: Blob) => {
    if (!liveSessionIdRef.current) return;
    frameQueueRef.current = [blob];
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
        .catch(() => {})
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

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
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

  const startCaptureLoop = (recommendedFps: number) => {
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);

    const intervalMs = Math.max(Math.floor(1000 / Math.max(recommendedFps, 1)), 1);
    captureTimerRef.current = setInterval(() => {
      if (!drawFrameToCanvas()) return;
      canvasRef.current?.toBlob(blob => blob && enqueueLatestFrame(blob), 'image/jpeg', 0.8);
    }, intervalMs);
  };

  const startStreaming = async (camera: WardCamera) => {
    const session = await createStreamSession({
      sessionId: camera.sessionId,
      cameraIdentifier: camera.deviceId,
      deviceType: 'web',
    });
    liveSessionIdRef.current = session.session_id ?? camera.sessionId;
    setRegisteredCamera(camera);
    setStatus('streaming');
    startCaptureLoop(camera.recommendedFps);
    void requestScreenWakeLock();
  };

  const restartExistingCamera = async () => {
    const deviceId = getStoredDeviceId();
    if (!deviceId) {
      setErrorMessage('이 기기의 카메라 정보를 찾지 못했습니다. 다시 등록해 주세요.');
      return;
    }

    setIsStartingStream(true);
    try {
      // 같은 기기는 이미 카메라로 등록돼 있다. 등록 API를 다시 호출하면 방 중복으로
      // 거절될 수 있으므로, 기존 카메라의 sessionId로 송출만 재개한다.
      const cameras = await getWardCameras();
      const camera = cameras.find(item => item.deviceId === deviceId);
      if (!camera) {
        setErrorMessage('등록된 카메라 정보를 찾지 못했습니다. 다시 등록해 주세요.');
        return;
      }
      await startStreaming(camera);
    } catch {
      setErrorMessage('카메라 송출을 다시 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsStartingStream(false);
    }
  };

  const handleRegister = () => {
    if (!room || registerMutation.isPending || isStartingStream) return;
    setErrorMessage('');

    if (initialRoom && room === initialRoom) {
      void restartExistingCamera();
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
            {initialRoom ? `"${initialRoom}" 카메라 ${isCameraRunning ? '관리' : '다시 켜기'}` : '이 기기를 카메라로 등록'}
          </strong>
          <button type="button" className={cx('closeButton')} onClick={handleClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={cx('body')}>
          <section className={cx('setupSection')}>
            <h2>1. 어디에 두셨나요?</h2>
            <RoomPicker
              rooms={rooms}
              selectedLabel={room}
              availableRegisteredLabel={initialRoom}
              disabled={status === 'streaming'}
              onSelect={setRoom}
            />
          </section>

          <section className={cx('setupSection')}>
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
          </section>

          <section className={cx('setupSection')}>
            <h2>3. 촬영 방식을 골라 주세요</h2>
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
            <h2>4. 미리보기를 확인해 주세요</h2>
            <div className={cx('previewBox')}>
            <video ref={videoRef} className={cx('sourceVideo')} autoPlay muted playsInline />
            <div className={cx('sentPreview')}>
              <span>AI에 전송되는 화면</span>
              <canvas ref={canvasRef} className={cx('canvas')} />
            </div>
            </div>
            {status === 'off' ? (
              <button type="button" className={cx('previewButton')} onClick={handleStartMedia}>
                <Icon name="camera" size={20} decorative />
                미리보기 시작
              </button>
            ) : (
              <button type="button" className={cx('previewButton', 'stop')} onClick={handleStopMedia}>
                <Icon name="camera" size={20} decorative />
                {status === 'streaming' ? '등록 취소하고 끄기' : '미리보기 끄기'}
              </button>
            )}
            <p className={cx('previewHint')}>AI에 전송되는 작은 미리보기에서 사람이 똑바로 보이는지 확인해 주세요.</p>
            {status !== 'off' && (
              <button type="button" className={cx('rotateButton')} onClick={handleRotate}>
                <Icon name="cameraFlip" size={20} decorative />
                <span>화면 회전</span>
                <strong>{rotation}°</strong>
              </button>
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
