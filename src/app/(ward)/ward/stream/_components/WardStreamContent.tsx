'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createStreamSession, ensureCameraRegistered, registerCamera, stopStreamSession, uploadFrame } from '@/service/api/streamSession';
import styles from './WardStreamContent.module.css';

type CameraFacing = 'user' | 'environment' | 'screen';

const MAX_QUEUE = 90;

function getMediaLabel(facing: CameraFacing) {
  return facing === 'screen' ? '화면' : '카메라';
}

export default function WardStreamContent() {
  /* ── 수동 업로드 상태 ── */
  const [sessionId, setSessionId] = useState('stream_001');
  const [cameraIdentifier, setCameraIdentifier] = useState('ipad-room-001');
  const [deviceType, setDeviceType] = useState('ipad');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  /* ── 카메라/스트림 상태 ── */
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('user');
  const [streamFps, setStreamFps] = useState(10);
  const [cameraReady, setCameraReady] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadQueueSize, setUploadQueueSize] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  /* ── 카메라 등록 폼 ── */
  const [showCamForm, setShowCamForm] = useState(false);
  const [camForm, setCamForm] = useState({
    cameraNo: '', identifier: 'ipad-room-001', name: '', streamUrl: '',
    streamType: 'rtsp', targetUserId: '', guardianUserId: '',
    locationName: '', isActive: true,
  });
  const [camMsg, setCamMsg] = useState('');
  const [camOk, setCamOk] = useState<boolean | null>(null);

  /* ── refs ── */
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaSourceRef = useRef<CameraFacing | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameQueueRef = useRef<Blob[]>([]);
  const isUploadingRef = useRef(false);
  const streamSessionIdRef = useRef<string | null>(null);

  /* ── 업로드 큐 드레인 ── */
  const drainQueue = useCallback(async () => {
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    while (frameQueueRef.current.length > 0 && streamSessionIdRef.current) {
      const blob = frameQueueRef.current.shift()!;
      setUploadQueueSize(frameQueueRef.current.length);
      try { await uploadFrame(streamSessionIdRef.current, blob); } catch { /* 실패 무시 */ }
    }
    isUploadingRef.current = false;
  }, []);

  /* ── 세션 생성 (수동) — 카메라 미등록 시 자동 등록 ── */
  async function createSession() {
    setLoading(true);
    setStatusMsg('카메라 확인 중…');
    try {
      await ensureCameraRegistered(cameraIdentifier, cameraIdentifier);
      const res = await createStreamSession({ sessionId, cameraIdentifier, deviceType });
      setActiveSessionId(res.session_id ?? sessionId);
      setStatusMsg(`세션 생성 완료: ${res.session_id ?? sessionId}`);
    } catch { setStatusMsg('세션 생성 실패'); }
    finally { setLoading(false); }
  }

  /* ── 프레임 업로드 (수동 JPEG) ── */
  async function handleUploadFrame() {
    if (!activeSessionId || !uploadFile) return;
    setLoading(true);
    try {
      await uploadFrame(activeSessionId, uploadFile);
      setStatusMsg('프레임 업로드 완료');
    } catch { setStatusMsg('업로드 실패'); }
    finally { setLoading(false); }
  }

  /* ── 송출 종료 ── */
  async function stopSession() {
    const sid = activeSessionId ?? streamSessionIdRef.current;
    if (!sid) return;
    setLoading(true);
    try {
      await stopStreamSession(sid);
      setActiveSessionId(null);
      streamSessionIdRef.current = null;
      setStatusMsg('송출 종료됨');
    } catch { setStatusMsg('종료 실패'); }
    finally { setLoading(false); }
  }

  /* ── 카메라/화면 켜기 ── */
  async function startCameraPreview() {
    try {
      const stream = cameraFacing === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true })
        : await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacing }, audio: false });
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = stream;
      mediaSourceRef.current = cameraFacing;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch { alert('카메라/화면 권한을 허용해주세요.'); }
  }

  /* ── 카메라/화면 끄기 ── */
  function stopCameraPreview() {
    stopCameraStreaming();
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    mediaSourceRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }

  /* ── 실시간 송출 시작 — 카메라 미등록 시 자동 등록 ── */
  async function startCameraStreaming() {
    if (!mediaStreamRef.current) { alert('먼저 카메라/화면을 켜주세요.'); return; }
    try {
      await ensureCameraRegistered(cameraIdentifier, cameraIdentifier);
      const liveId = `live_${Date.now()}`;
      const res = await createStreamSession({ sessionId: liveId, cameraIdentifier, deviceType });
      streamSessionIdRef.current = res.session_id ?? liveId;
      setIsStreaming(true);

      captureTimerRef.current = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        canvas.toBlob(blob => {
          if (!blob) return;
          if (frameQueueRef.current.length >= MAX_QUEUE) frameQueueRef.current.shift();
          frameQueueRef.current.push(blob);
          setUploadQueueSize(frameQueueRef.current.length);
          void drainQueue();
        }, 'image/jpeg', 0.8);
      }, Math.floor(1000 / streamFps));
    } catch { alert('세션 생성에 실패했습니다.'); }
  }

  /* ── 실시간 송출 중지 ── */
  function stopCameraStreaming() {
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    captureTimerRef.current = null;
    frameQueueRef.current = [];
    setUploadQueueSize(0);
    setIsStreaming(false);
  }

  useEffect(() => () => {
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 카메라 등록 ── */
  async function handleRegisterCamera(e: React.FormEvent) {
    e.preventDefault();
    try {
      await registerCamera({ ...camForm });
      setCamOk(true);
      setCamMsg('카메라가 등록됐습니다.');
    } catch {
      setCamOk(false);
      setCamMsg('등록에 실패했습니다.');
    }
  }

  return (
    <div className={styles.page}>
      {/* ── 피보호자 송출 제어 ── */}
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>피보호자 송출 제어</h2>

        <div className={styles.grid3}>
          <label className={styles.field}>
            Session ID
            <input value={sessionId} onChange={e => setSessionId(e.target.value)} />
          </label>
          <label className={styles.field}>
            Camera Identifier
            <input value={cameraIdentifier} onChange={e => setCameraIdentifier(e.target.value)} />
          </label>
          <label className={styles.field}>
            Device Type
            <select value={deviceType} onChange={e => setDeviceType(e.target.value)}>
              <option value="ipad">iPad</option>
              <option value="phone">Phone</option>
              <option value="web">Web</option>
            </select>
          </label>
          <label className={styles.field}>
            Frame (JPEG)
            <input type="file" accept="image/jpeg" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className={styles.field}>
            Camera Facing
            <select value={cameraFacing} onChange={e => setCameraFacing(e.target.value as CameraFacing)}>
              <option value="user">정면 (user)</option>
              <option value="environment">후면 (environment)</option>
              <option value="screen">화면</option>
            </select>
          </label>
          <label className={styles.field}>
            Stream FPS (캡처 목표, 업로드는 큐 처리)
            <input
              type="number" min={1} max={30} value={streamFps}
              onChange={e => setStreamFps(Number(e.target.value) || 1)}
            />
          </label>
          {isStreaming && uploadQueueSize > 0 && (
            <p className={styles.hint}>업로드 대기: {uploadQueueSize}장 (네트워크가 느리면 지연 누적)</p>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={createSession} disabled={loading}>세션 생성</button>
          <button type="button" onClick={handleUploadFrame} disabled={loading || !uploadFile || !activeSessionId}>프레임 업로드</button>
          <button type="button" onClick={stopSession} disabled={loading}>송출 종료</button>
          <button
            type="button"
            onClick={startCameraPreview}
            disabled={cameraReady && mediaSourceRef.current === cameraFacing}
          >
            {cameraFacing === 'screen' ? '화면 켜기' : '카메라 켜기'}
          </button>
          <button type="button" onClick={stopCameraPreview}>
            {cameraFacing === 'screen' ? '화면 끄기' : '카메라 끄기'}
          </button>
          <button type="button" onClick={startCameraStreaming} disabled={isStreaming}>
            {getMediaLabel(cameraFacing)} 송출 시작
          </button>
          <button type="button" onClick={stopCameraStreaming} disabled={!isStreaming}>
            {getMediaLabel(cameraFacing)} 송출 중지
          </button>
        </div>

        {statusMsg && <p className={styles.statusMsg}>{statusMsg}</p>}

        <div className={styles.wardStreamBox}>
          <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
          <canvas ref={canvasRef} className={styles.hiddenCanvas} />
          <p className={styles.mediaStatus}>
            미디어 상태: {cameraReady ? `${getMediaLabel(mediaSourceRef.current ?? cameraFacing)} ready` : 'off'}{' '}
            / 송출 상태: {isStreaming ? 'streaming' : 'idle'}
          </p>
        </div>
      </section>

      {/* ── 카메라 등록 ── */}
      <section className={styles.panel}>
        <button type="button" className={styles.toggleBtn} onClick={() => setShowCamForm(v => !v)}>
          카메라 등록 {showCamForm ? '▲' : '▼'}
        </button>

        {showCamForm && (
          <form onSubmit={handleRegisterCamera}>
            <div className={styles.grid3}>
              {([
                ['cameraNo', '카메라 번호', 'CAM-001'],
                ['identifier', 'Identifier', 'ipad-room-001'],
                ['name', '카메라 이름', '거실 카메라'],
                ['streamUrl', '스트림 URL', 'rtsp://...'],
                ['targetUserId', '피보호자 ID', ''],
                ['guardianUserId', '보호자 ID', ''],
                ['locationName', '위치명', '거실'],
              ] as [keyof typeof camForm, string, string][]).map(([key, label, ph]) => (
                <label key={key} className={styles.field}>
                  {label}
                  <input
                    placeholder={ph}
                    value={String(camForm[key])}
                    onChange={e => setCamForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </label>
              ))}
              <label className={styles.field}>
                스트림 타입
                <select value={camForm.streamType} onChange={e => setCamForm(f => ({ ...f, streamType: e.target.value }))}>
                  <option value="rtsp">RTSP</option>
                  <option value="http">HTTP</option>
                  <option value="webrtc">WebRTC</option>
                </select>
              </label>
              <label className={`${styles.field} ${styles.checkRow}`}>
                <input type="checkbox" checked={camForm.isActive} onChange={e => setCamForm(f => ({ ...f, isActive: e.target.checked }))} />
                활성화
              </label>
            </div>
            {camMsg && <p className={`${styles.statusMsg} ${camOk ? styles.ok : styles.err}`}>{camMsg}</p>}
            <div className={styles.actions}>
              <button type="submit">등록</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
