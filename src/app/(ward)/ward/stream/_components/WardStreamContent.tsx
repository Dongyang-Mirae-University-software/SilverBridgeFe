'use client';

import { useEffect, useRef, useState } from 'react';
import { createStreamSession, registerCamera, stopStreamSession, uploadFrame } from '@/service/api/streamSession';
import styles from './WardStreamContent.module.css';

type Tab = 'live' | 'manual';
type CameraFacing = 'user' | 'environment' | 'screen';
type StreamStatus = 'off' | 'ready' | 'streaming';

const MAX_QUEUE = 90;
const DEFAULT_CAM_ID = 'ipad-room-001';

const FACING_OPTIONS: { value: CameraFacing; label: string; icon: string }[] = [
  { value: 'user',        label: '정면 카메라', icon: '🤳' },
  { value: 'environment', label: '후면 카메라', icon: '📷' },
  { value: 'screen',      label: '화면 공유',   icon: '🖥️' },
];

export default function WardStreamContent() {
  const [tab, setTab] = useState<Tab>('live');

  /* ── 실시간 상태 ── */
  const [facing, setFacing]         = useState<CameraFacing>('user');
  const [fps, setFps]               = useState(10);
  const [camId, setCamId]           = useState(DEFAULT_CAM_ID);
  const [status, setStatus]         = useState<StreamStatus>('off');
  const [queueCount, setQueueCount] = useState(0);
  const [liveMsg, setLiveMsg]       = useState('');

  /* ── 수동 업로드 상태 ── */
  const [manualSessionId, setManualSessionId] = useState('stream_001');
  const [manualCamId, setManualCamId]         = useState(DEFAULT_CAM_ID);
  const [activeSession, setActiveSession]     = useState<string | null>(null);
  const [manualFile, setManualFile]           = useState<File | null>(null);
  const [manualMsg, setManualMsg]             = useState('');
  const [manualLoading, setManualLoading]     = useState(false);

  /* ── 카메라 등록 (접이식) ── */
  const [showCamReg, setShowCamReg] = useState(false);
  const [camRegForm, setCamRegForm] = useState({
    cameraNo: '', identifier: DEFAULT_CAM_ID, name: '',
    streamUrl: '', streamType: 'rtsp',
    targetUserId: '', guardianUserId: '', locationName: '', isActive: true,
  });
  const [camRegMsg, setCamRegMsg] = useState('');
  const [camRegOk, setCamRegOk]   = useState<boolean | null>(null);

  /* ── refs ── */
  const videoRef          = useRef<HTMLVideoElement>(null);
  const canvasRef         = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef    = useRef<MediaStream | null>(null);
  const captureTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameQueueRef     = useRef<Blob[]>([]);
  const isUploadingRef    = useRef(false);
  const liveSessionIdRef  = useRef<string | null>(null);

  /* ── 업로드 루프 ── */
  async function drainQueue() {
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    while (frameQueueRef.current.length > 0 && liveSessionIdRef.current) {
      const blob = frameQueueRef.current.shift()!;
      setQueueCount(frameQueueRef.current.length);
      try { await uploadFrame(liveSessionIdRef.current, blob); } catch { /* 실패 무시 */ }
    }
    isUploadingRef.current = false;
  }

  /* ── 카메라/화면 켜기 ── */
  async function handleStartMedia() {
    try {
      const stream = facing === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true })
        : await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus('ready');
      setLiveMsg('');
    } catch { setLiveMsg('카메라/화면 권한을 허용해주세요.'); }
  }

  /* ── 카메라/화면 끄기 ── */
  function handleStopMedia() {
    handleStopStreaming();
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('off');
  }

  /* ── 송출 시작 ── */
  async function handleStartStreaming() {
    if (!mediaStreamRef.current) return;
    try {
      const sid = `live_${Date.now()}`;
      const res = await createStreamSession({ sessionId: sid, cameraIdentifier: camId, deviceType: 'web' });
      liveSessionIdRef.current = res.session_id ?? sid;
      setStatus('streaming');
      setLiveMsg('');

      captureTimerRef.current = setInterval(() => {
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        canvas.toBlob(blob => {
          if (!blob) return;
          if (frameQueueRef.current.length >= MAX_QUEUE) frameQueueRef.current.shift();
          frameQueueRef.current.push(blob);
          setQueueCount(frameQueueRef.current.length);
          void drainQueue();
        }, 'image/jpeg', 0.8);
      }, Math.floor(1000 / fps));
    } catch { setLiveMsg('세션 생성에 실패했습니다. 다시 시도해주세요.'); }
  }

  /* ── 송출 중지 ── */
  function handleStopStreaming() {
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    captureTimerRef.current = null;
    frameQueueRef.current   = [];
    setQueueCount(0);
    if (status === 'streaming') setStatus('ready');
  }

  /* ── 화면 전환 시 미디어 정리 ── */
  function handleFacingChange(f: CameraFacing) {
    if (status !== 'off') handleStopMedia();
    setFacing(f);
  }

  useEffect(() => () => {
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 수동 업로드 액션들 ── */
  async function handleCreateSession() {
    setManualLoading(true); setManualMsg('');
    try {
      const res = await createStreamSession({ sessionId: manualSessionId, cameraIdentifier: manualCamId, deviceType: 'web' });
      setActiveSession(res.session_id ?? manualSessionId);
      setManualMsg('세션이 생성됐습니다.');
    } catch { setManualMsg('세션 생성 실패'); }
    finally { setManualLoading(false); }
  }

  async function handleUploadFrame() {
    if (!activeSession || !manualFile) return;
    setManualLoading(true); setManualMsg('');
    try {
      await uploadFrame(activeSession, manualFile);
      setManualMsg('프레임 업로드 완료');
    } catch { setManualMsg('업로드 실패'); }
    finally { setManualLoading(false); }
  }

  async function handleStopSession() {
    if (!activeSession) return;
    setManualLoading(true);
    try {
      await stopStreamSession(activeSession);
      setActiveSession(null); setManualMsg('송출이 종료됐습니다.');
    } catch { setManualMsg('종료 실패'); }
    finally { setManualLoading(false); }
  }

  /* ── 카메라 등록 ── */
  async function handleCamReg(e: React.FormEvent) {
    e.preventDefault();
    try {
      await registerCamera({ ...camRegForm });
      setCamRegOk(true); setCamRegMsg('카메라가 등록됐습니다.');
    } catch { setCamRegOk(false); setCamRegMsg('등록 실패'); }
  }

  /* ── 상태 표시 ── */
  const statusLabel = status === 'off' ? '오프라인' : status === 'ready' ? '카메라 켜짐' : '송출 중';
  const statusDot   = status === 'off' ? styles.dotOff : status === 'ready' ? styles.dotReady : styles.dotLive;

  return (
    <div className={styles.page}>
      {/* 탭 */}
      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${tab === 'live' ? styles.active : ''}`} onClick={() => setTab('live')}>실시간 송출</button>
        <button type="button" className={`${styles.tab} ${tab === 'manual' ? styles.active : ''}`} onClick={() => setTab('manual')}>수동 업로드</button>
      </div>

      {/* ── 실시간 송출 ── */}
      {tab === 'live' && (
        <div className={styles.livePanel}>

          {/* STEP 1 — 미디어 선택 */}
          <div className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <div className={styles.stepBody}>
              <p className={styles.stepTitle}>카메라 / 화면 선택</p>
              <div className={styles.facingGrid}>
                {FACING_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.facingCard} ${facing === opt.value ? styles.facingActive : ''}`}
                    disabled={status !== 'off'}
                    onClick={() => handleFacingChange(opt.value)}
                  >
                    <span className={styles.facingIcon}>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 2 — 미리보기 */}
          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <div className={styles.stepBody}>
              <p className={styles.stepTitle}>미리보기</p>
              <div className={styles.videoBox}>
                <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
                <canvas ref={canvasRef} className={styles.hiddenCanvas} />
                {status === 'off' && (
                  <div className={styles.videoPlaceholder}>
                    <span>카메라를 켜면 여기에 화면이 표시됩니다</span>
                  </div>
                )}
              </div>
              <div className={styles.mediaCtrl}>
                {status === 'off'
                  ? <button type="button" className={styles.btnPrimary} onClick={handleStartMedia}>
                      {facing === 'screen' ? '🖥️  화면 켜기' : '📷  카메라 켜기'}
                    </button>
                  : <button type="button" className={styles.btnDanger} onClick={handleStopMedia}>
                      {facing === 'screen' ? '화면 끄기' : '카메라 끄기'}
                    </button>
                }
              </div>
            </div>
          </div>

          {/* STEP 3 — 송출 */}
          <div className={`${styles.step} ${status === 'off' ? styles.stepDisabled : ''}`}>
            <span className={styles.stepNum}>3</span>
            <div className={styles.stepBody}>
              <div className={styles.stepTitleRow}>
                <p className={styles.stepTitle}>송출 설정 및 시작</p>
                <span className={`${styles.statusDot} ${statusDot}`}>{statusLabel}</span>
              </div>

              <div className={styles.settingsRow}>
                <label className={styles.settingField}>
                  <span>Camera ID</span>
                  <input value={camId} onChange={e => setCamId(e.target.value)} disabled={status === 'streaming'} />
                </label>
                <label className={styles.settingField}>
                  <span>FPS <strong>{fps}</strong></span>
                  <input type="range" min={1} max={30} value={fps} disabled={status === 'streaming'}
                    onChange={e => setFps(Number(e.target.value))} className={styles.fpsSlider} />
                </label>
              </div>

              <div className={styles.streamCtrl}>
                {status !== 'streaming'
                  ? <button type="button" className={styles.btnStart} disabled={status === 'off'} onClick={handleStartStreaming}>
                      ▶ 송출 시작
                    </button>
                  : <button type="button" className={styles.btnStop} onClick={handleStopStreaming}>
                      ■ 송출 중지
                    </button>
                }
                {status === 'streaming' && queueCount > 0 && (
                  <span className={styles.queueBadge}>대기 {queueCount}장</span>
                )}
              </div>

              {liveMsg && <p className={styles.errMsg}>{liveMsg}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── 수동 업로드 ── */}
      {tab === 'manual' && (
        <div className={styles.manualPanel}>
          <div className={styles.manualGrid}>
            <label className={styles.field}>
              <span>Session ID</span>
              <input value={manualSessionId} onChange={e => setManualSessionId(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Camera Identifier</span>
              <input value={manualCamId} onChange={e => setManualCamId(e.target.value)} />
            </label>
          </div>

          {activeSession && (
            <div className={styles.activeSessionBadge}>
              세션 활성 중: <strong>{activeSession}</strong>
            </div>
          )}

          <label className={styles.field}>
            <span>JPEG 파일 선택</span>
            <input type="file" accept="image/jpeg" onChange={e => setManualFile(e.target.files?.[0] ?? null)} />
          </label>

          <div className={styles.manualBtns}>
            <button type="button" className={styles.btnPrimary} disabled={manualLoading || !!activeSession} onClick={handleCreateSession}>세션 생성</button>
            <button type="button" className={styles.btnSecondary} disabled={manualLoading || !manualFile || !activeSession} onClick={handleUploadFrame}>프레임 업로드</button>
            <button type="button" className={styles.btnDanger} disabled={manualLoading || !activeSession} onClick={handleStopSession}>송출 종료</button>
          </div>

          {manualMsg && <p className={styles.infoMsg}>{manualMsg}</p>}
        </div>
      )}

      {/* ── 카메라 등록 (고급) ── */}
      <div className={styles.advancedWrap}>
        <button type="button" className={styles.advancedToggle} onClick={() => setShowCamReg(v => !v)}>
          ⚙️ 카메라 등록 (고급) {showCamReg ? '▲' : '▼'}
        </button>
        {showCamReg && (
          <form className={styles.camRegForm} onSubmit={handleCamReg}>
            <div className={styles.manualGrid}>
              {([
                ['cameraNo', '카메라 번호', 'CAM-001'],
                ['identifier', 'Identifier', 'ipad-room-001'],
                ['name', '이름', '거실 카메라'],
                ['streamUrl', '스트림 URL', 'rtsp://...'],
                ['targetUserId', '피보호자 ID', ''],
                ['guardianUserId', '보호자 ID', ''],
                ['locationName', '위치', '거실'],
              ] as [keyof typeof camRegForm, string, string][]).map(([key, label, ph]) => (
                <label key={key} className={styles.field}>
                  <span>{label}</span>
                  <input placeholder={ph} value={String(camRegForm[key])}
                    onChange={e => setCamRegForm(f => ({ ...f, [key]: e.target.value }))} />
                </label>
              ))}
              <label className={styles.field}>
                <span>스트림 타입</span>
                <select value={camRegForm.streamType} onChange={e => setCamRegForm(f => ({ ...f, streamType: e.target.value }))}>
                  <option value="rtsp">RTSP</option>
                  <option value="http">HTTP</option>
                  <option value="webrtc">WebRTC</option>
                </select>
              </label>
            </div>
            {camRegMsg && <p className={`${styles.infoMsg} ${camRegOk === false ? styles.errMsg : ''}`}>{camRegMsg}</p>}
            <button type="submit" className={styles.btnPrimary}>등록</button>
          </form>
        )}
      </div>
    </div>
  );
}
