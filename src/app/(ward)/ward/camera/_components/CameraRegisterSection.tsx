'use client';

import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { createStreamSession, stopStreamSession, uploadFrame } from '@/service/api/streamSession';
import { getStoredDeviceId, setStoredDeviceId } from '@/lib/device/deviceId';
import { useRegisterWardCameraMutation } from '@/service/query/ward/camera';
import { WardCamera } from '@/service/interface/ward/camera';
import styles from './CameraRegisterSection.module.css';

const cx = classNames.bind(styles);

type CameraFacing = 'user' | 'environment' | 'screen';
type StreamStatus = 'off' | 'ready' | 'streaming';

const FACING_OPTIONS: Array<{ value: CameraFacing; label: string }> = [
  { value: 'user', label: '전면 카메라' },
  { value: 'environment', label: '후면 카메라' },
  { value: 'screen', label: '화면 공유' },
];

const ROOM_OPTIONS = ['거실', '안방', '방1', '방2', '방3'] as const;
const CUSTOM_ROOM_OPTION = '+ 직접입력';
const MIN_UPLOAD_INTERVAL_MS = 500;

export function CameraRegisterSection() {
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [status, setStatus] = useState<StreamStatus>('off');
  const [room, setRoom] = useState<string>('');
  const [customRoom, setCustomRoom] = useState('');
  const [isCustomRoom, setIsCustomRoom] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [registeredCamera, setRegisteredCamera] = useState<WardCamera | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveSessionIdRef = useRef<string | null>(null);
  const frameQueueRef = useRef<Blob[]>([]);
  const isUploadingRef = useRef(false);

  const registerMutation = useRegisterWardCameraMutation();
  const label = isCustomRoom ? customRoom.trim() : room;

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
    if (!label || registerMutation.isPending) return;
    setErrorMessage('');

    registerMutation.mutate(
      { label, deviceId: getStoredDeviceId() },
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
        onError: () => setErrorMessage('카메라 등록에 실패했습니다. 다시 시도해 주세요.'),
      },
    );
  };

  return (
    <section className={cx('card')}>
      <header className={cx('header')}>
        <strong>카메라 등록</strong>
        <p>방을 고르고 버튼을 누르면 등록됩니다. 따로 입력할 건 없어요.</p>
      </header>

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
          <div className={cx('roomRow')}>
            {ROOM_OPTIONS.map(option => (
              <button
                key={option}
                type="button"
                className={cx('roomChip', { active: !isCustomRoom && room === option })}
                disabled={status === 'streaming'}
                onClick={() => {
                  setIsCustomRoom(false);
                  setRoom(option);
                }}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              className={cx('roomChip', { active: isCustomRoom })}
              disabled={status === 'streaming'}
              onClick={() => setIsCustomRoom(true)}
            >
              {CUSTOM_ROOM_OPTION}
            </button>
          </div>

          {isCustomRoom && (
            <input
              className={cx('roomInput')}
              value={customRoom}
              onChange={event => setCustomRoom(event.target.value)}
              placeholder="예) 며느리방"
              maxLength={30}
              disabled={status === 'streaming'}
            />
          )}

          {status === 'ready' && (
            <button
              type="button"
              className={cx('registerButton')}
              disabled={!label || registerMutation.isPending}
              onClick={handleRegister}
            >
              {registerMutation.isPending ? '등록 중...' : '카메라 등록'}
            </button>
          )}

          {status === 'streaming' && registeredCamera && (
            <p className={cx('streamingNotice')}>&quot;{registeredCamera.label}&quot; 카메라가 송출 중입니다.</p>
          )}
        </div>
      )}

      {errorMessage && <p className={cx('error')}>{errorMessage}</p>}
    </section>
  );
}
