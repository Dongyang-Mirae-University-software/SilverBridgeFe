'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { createStreamSession, stopStreamSession, uploadFrame } from '@/service/api/streamSession';
import { getStoredDeviceId, setStoredDeviceId } from '@/lib/device/deviceId';
import { useRegisterWardCameraMutation, wardCameraRoomsQueryOptions } from '@/service/query/ward/camera';
import { WardCamera } from '@/service/interface/ward/camera';
import { RoomPicker } from './RoomPicker';
import styles from './CameraRegisterModal.module.css';

const cx = classNames.bind(styles);

type CameraFacing = 'user' | 'environment' | 'screen';
type StreamStatus = 'off' | 'ready' | 'streaming';

const FACING_OPTIONS: Array<{ value: CameraFacing; label: string }> = [
  { value: 'user', label: '전면 카메라' },
  { value: 'environment', label: '후면 카메라' },
  { value: 'screen', label: '화면 공유' },
];

const MIN_UPLOAD_INTERVAL_MS = 500;

function getErrorCode(error: unknown) {
  return (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
}

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { message?: string })?.message ?? fallback;
}

export function CameraRegisterModal({
  initialRoom,
  onClose,
}: {
  // 이 기기가 쓰던 카메라가 끊겨서 다시 켤 때 — 원래 쓰던 방을 미리 선택해 둔다.
  // 같은 기기·같은 방으로 다시 등록하면 백엔드가 기존 sessionId를 그대로 재사용한다
  initialRoom?: string;
  onClose: () => void;
}) {
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [status, setStatus] = useState<StreamStatus>('off');
  const [room, setRoom] = useState(initialRoom ?? '');
  const [errorMessage, setErrorMessage] = useState('');
  const [registeredCamera, setRegisteredCamera] = useState<WardCamera | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveSessionIdRef = useRef<string | null>(null);
  const frameQueueRef = useRef<Blob[]>([]);
  const isUploadingRef = useRef(false);

  const { data: rooms = [], refetch: refetchRooms } = useQuery(wardCameraRoomsQueryOptions);
  const registerMutation = useRegisterWardCameraMutation();

  useEffect(() => {
    return () => {
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const handleStartMedia = async () => {
    setErrorMessage('');
    try {
      const stream =
        facing === 'screen'
          ? await navigator.mediaDevices.getDisplayMedia({ video: true })
          : await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });

      mediaStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus('ready');
    } catch {
      setErrorMessage('카메라·화면 접근 권한이 필요합니다.');
    }
  };

  const handleStopMedia = async () => {
    if (liveSessionIdRef.current) {
      await stopStreamSession(liveSessionIdRef.current).catch(() => {});
      liveSessionIdRef.current = null;
    }
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    frameQueueRef.current = [];
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('off');
    setRegisteredCamera(null);
  };

  const handleClose = () => {
    void handleStopMedia();
    onClose();
  };

  const enqueueLatestFrame = (blob: Blob) => {
    frameQueueRef.current = [blob];
    void drainQueue();
  };

  const drainQueue = async () => {
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    try {
      while (frameQueueRef.current.length > 0 && liveSessionIdRef.current) {
        const blob = frameQueueRef.current.pop();
        frameQueueRef.current = [];
        if (!blob) break;
        await uploadFrame(liveSessionIdRef.current, blob).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, MIN_UPLOAD_INTERVAL_MS));
      }
    } finally {
      isUploadingRef.current = false;
    }
  };

  const startCaptureLoop = (recommendedFps: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const intervalMs = Math.max(Math.floor(1000 / recommendedFps), 1);
    captureTimerRef.current = setInterval(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => blob && enqueueLatestFrame(blob), 'image/jpeg', 0.8);
    }, intervalMs);
  };

  const handleRegister = () => {
    if (!room || registerMutation.isPending) return;
    setErrorMessage('');

    registerMutation.mutate(
      { label: room, deviceId: getStoredDeviceId() },
      {
        onSuccess: async camera => {
          if (!camera) return;
          setStoredDeviceId(camera.deviceId);
          setRegisteredCamera(camera);

          try {
            const session = await createStreamSession({
              sessionId: camera.sessionId,
              cameraIdentifier: camera.deviceId,
              deviceType: 'web',
            });
            liveSessionIdRef.current = session.session_id ?? camera.sessionId;
            setStatus('streaming');
            startCaptureLoop(camera.recommendedFps);
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

  return (
    <div className={cx('overlay')} role="presentation">
      <div className={cx('modal')} role="dialog" aria-modal="true" aria-label="카메라 등록">
        <header className={cx('header')}>
          <strong>{initialRoom ? `"${initialRoom}" 카메라 다시 켜기` : '이 기기를 카메라로 등록'}</strong>
          <button type="button" className={cx('closeButton')} onClick={handleClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={cx('body')}>
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

          <div className={cx('previewBox')}>
            <video ref={videoRef} className={cx('video')} autoPlay muted playsInline />
            <canvas ref={canvasRef} className={cx('hiddenCanvas')} />
            {status === 'off' ? (
              <button type="button" className={cx('previewButton')} onClick={handleStartMedia}>
                미리보기 시작
              </button>
            ) : (
              <button type="button" className={cx('previewButton', 'stop')} onClick={handleStopMedia}>
                {status === 'streaming' ? '등록 취소하고 끄기' : '미리보기 끄기'}
              </button>
            )}
          </div>

          {status !== 'off' && (
            <div className={cx('roomSection')}>
              <span className={cx('roomLabel')}>어느 방인가요?</span>
              <RoomPicker
                rooms={rooms}
                selectedLabel={room}
                currentLabel={initialRoom}
                disabled={status === 'streaming'}
                onSelect={setRoom}
              />

              {status === 'ready' && (
                <button
                  type="button"
                  className={cx('registerButton')}
                  disabled={!room || registerMutation.isPending}
                  onClick={handleRegister}
                >
                  {registerMutation.isPending ? '등록 중...' : '등록하고 촬영 시작'}
                </button>
              )}

              {status === 'streaming' && registeredCamera && (
                <p className={cx('streamingNotice')}>
                  &quot;{registeredCamera.label}&quot; 카메라가 송출 중입니다. 이 화면을 유지해야 촬영이 계속돼요.
                </p>
              )}
            </div>
          )}

          {errorMessage && <p className={cx('error')}>{errorMessage}</p>}
        </div>

        {status === 'streaming' && (
          <footer className={cx('footer')}>
            <button type="button" className={cx('doneButton')} onClick={onClose}>
              완료
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
