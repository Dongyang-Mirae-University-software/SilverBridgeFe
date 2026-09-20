'use client';

import { useEffect, useRef, useState } from 'react';
import { createStreamSession, registerCamera, stopStreamSession, uploadFrame } from '@/service/api/streamSession';
import { Icon } from '@/components/Icon';
import styles from './Stream.module.css';

type CameraFacing = 'user' | 'environment' | 'screen';
type StreamStatus = 'off' | 'ready' | 'streaming';

const DEFAULT_CAM_ID = 'ipad-room-001';
const MIN_UPLOAD_INTERVAL_MS = 500; // 최대 초당 2프레임 업로드

const FACING_OPTIONS: { value: CameraFacing; label: string; icon: 'cameraFlip' | 'camera' | 'monitor' }[] = [
  { value: 'user', label: '정면 카메라', icon: 'cameraFlip' },
  { value: 'environment', label: '후면 카메라', icon: 'camera' },
  { value: 'screen', label: '화면 공유', icon: 'monitor' },
];

export default function Stream() {
  /* ── 실시간 상태 ── */
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [fps, setFps] = useState(5);
  const [liveSessionName, setLiveSessionName] = useState('stream_001');
  const [camId, setCamId] = useState(DEFAULT_CAM_ID);
  const [status, setStatus] = useState<StreamStatus>('off');
  const [queueCount, setQueueCount] = useState(0);
  const [isStoppingLive, setIsStoppingLive] = useState(false);
  const [liveMsg, setLiveMsg] = useState('');

  /* ── 수동 업로드 상태 ── */
  const [manualSessionId, setManualSessionId] = useState('stream_001');
  const [manualCamId, setManualCamId] = useState(DEFAULT_CAM_ID);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualMsg, setManualMsg] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  /* ── 카메라 등록 ── */
  const [camRegForm, setCamRegForm] = useState({
    cameraNo: 'CAM-001',
    identifier: DEFAULT_CAM_ID,
    name: '거실 카메라',
    streamUrl: 'rtsp://192.168.1.100:554/live',
    streamType: 'rtsp',
    targetUserId: '',
    guardianUserId: '',
    locationName: '거실',
    isActive: true,
  });
  const [camRegMsg, setCamRegMsg] = useState('');
  const [camRegOk, setCamRegOk] = useState<boolean | null>(null);

  /* ── refs ── */
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameQueueRef = useRef<Blob[]>([]);
  const isUploadingRef = useRef(false);
  const liveSessionIdRef = useRef<string | null>(null);

  function enqueueLatestFrame(blob: Blob) {
    frameQueueRef.current = [blob];
    setQueueCount(frameQueueRef.current.length);
    void drainQueue();
  }

  /* ── 업로드 루프 — 오래된 프레임을 버리고 최신 프레임만 순차 처리 ── */
  async function drainQueue() {
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    while (frameQueueRef.current.length > 0 && liveSessionIdRef.current) {
      const blob = frameQueueRef.current.pop()!;
      frameQueueRef.current = [];
      setQueueCount(0);
      const start = Date.now();
      try {
        await uploadFrame(liveSessionIdRef.current, blob);
      } catch {
        /* 실패 무시 */
      }
      const elapsed = Date.now() - start;
      const wait = MIN_UPLOAD_INTERVAL_MS - elapsed;
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
    }
    isUploadingRef.current = false;
  }

  /* ── 카메라/화면 켜기 ── */
  async function handleStartMedia() {
    try {
      const stream =
        facing === 'screen'
          ? await navigator.mediaDevices.getDisplayMedia({ video: true })
          : await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus('ready');
      setLiveMsg('');
    } catch {
      setLiveMsg('카메라/화면 권한을 허용해주세요.');
    }
  }

  /* ── 송출 종료 ── */
  async function handleStopMedia() {
    if (isStoppingLive) return;
    const sessionId = liveSessionIdRef.current;
    liveSessionIdRef.current = null;
    handleStopStreaming();

    setIsStoppingLive(true);
    try {
      if (sessionId) await stopStreamSession(sessionId);
      setLiveMsg(sessionId ? '송출이 종료됐습니다.' : '');
    } catch {
      setLiveMsg('송출 종료 요청에 실패했습니다.');
    } finally {
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setStatus('off');
      setIsStoppingLive(false);
    }
  }

  /* ── 송출 시작 ── */
  async function handleStartStreaming() {
    if (!mediaStreamRef.current) return;
    const sid = liveSessionName.trim();
    if (!sid) {
      setLiveMsg('세션 이름을 입력해주세요.');
      return;
    }

    try {
      const res = await createStreamSession({ sessionId: sid, cameraIdentifier: camId, deviceType: 'web' });
      liveSessionIdRef.current = res.session_id ?? sid;
      setStatus('streaming');
      setLiveMsg('');

      captureTimerRef.current = setInterval(
        () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas) return;
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          canvas.getContext('2d')?.drawImage(video, 0, 0);
          canvas.toBlob(
            blob => {
              if (!blob) return;
              enqueueLatestFrame(blob);
            },
            'image/jpeg',
            0.8,
          );
        },
        Math.floor(1000 / fps),
      );
    } catch {
      setLiveMsg('세션 생성에 실패했습니다. 다시 시도해주세요.');
    }
  }

  /* ── 송출 중지 ── */
  function handleStopStreaming() {
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    captureTimerRef.current = null;
    frameQueueRef.current = [];
    setQueueCount(0);
    if (status === 'streaming') setStatus('ready');
  }

  /* ── 화면 전환 시 미디어 정리 ── */
  function handleFacingChange(f: CameraFacing) {
    if (status !== 'off') handleStopMedia();
    setFacing(f);
  }

  useEffect(
    () => () => {
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    },
    [],
  );

  /* ── 수동 업로드 액션들 ── */
  async function handleCreateSession() {
    setManualLoading(true);
    setManualMsg('');
    try {
      const res = await createStreamSession({
        sessionId: manualSessionId,
        cameraIdentifier: manualCamId,
        deviceType: 'web',
      });
      setActiveSession(res.session_id ?? manualSessionId);
      setManualMsg('세션이 생성됐습니다.');
    } catch {
      setManualMsg('세션 생성 실패');
    } finally {
      setManualLoading(false);
    }
  }

  async function handleUploadFrame() {
    if (!activeSession || !manualFile) return;
    setManualLoading(true);
    setManualMsg('');
    try {
      await uploadFrame(activeSession, manualFile);
      setManualMsg('프레임 업로드 완료');
    } catch {
      setManualMsg('업로드 실패');
    } finally {
      setManualLoading(false);
    }
  }

  async function handleStopSession() {
    if (!activeSession) return;
    setManualLoading(true);
    try {
      await stopStreamSession(activeSession);
      setActiveSession(null);
      setManualMsg('송출이 종료됐습니다.');
    } catch {
      setManualMsg('종료 실패');
    } finally {
      setManualLoading(false);
    }
  }

  /* ── 카메라 등록 ── */
  async function handleCamReg(e: React.FormEvent) {
    e.preventDefault();
    try {
      await registerCamera({ ...camRegForm });
      setCamRegOk(true);
      setCamRegMsg('카메라가 등록됐습니다.');
    } catch {
      setCamRegOk(false);
      setCamRegMsg('등록 실패');
    }
  }

  /* ── 상태 표시 ── */
  const statusLabel = status === 'off' ? '오프라인' : status === 'ready' ? '카메라 켜짐' : '송출 중';
  const statusDot = status === 'off' ? styles.dotOff : status === 'ready' ? styles.dotReady : styles.dotLive;
  const selectedSource = FACING_OPTIONS.find(option => option.value === facing)?.label ?? '정면 카메라';

  return (
    <div className={styles.page}>
      <section className={styles.guide}>
        <span className={styles.guideIcon}>
          <Icon name="camera" size={26} />
        </span>
        <div className={styles.guideCopy}>
          <strong>보여줄 화면을 선택하고 송출을 시작하세요</strong>
          <span>송출 전 미리보기로 화면을 확인할 수 있습니다.</span>
        </div>
        <span className={`${styles.statusDot} ${statusDot}`} aria-live="polite">
          {statusLabel}
        </span>
      </section>
      <div className={styles.livePanel}>
        {/* STEP 1 — 미디어 선택 */}
        <div className={styles.step}>
          <span className={styles.stepNum}>1</span>
          <div className={styles.stepBody}>
            <div className={styles.stepHeading}>
              <p className={styles.stepTitle}>무엇을 송출할까요?</p>
              <span>사용할 카메라나 화면을 선택하세요.</span>
            </div>
            <div className={styles.facingGrid}>
              {FACING_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.facingCard} ${facing === opt.value ? styles.facingActive : ''}`}
                  disabled={status !== 'off'}
                  aria-pressed={facing === opt.value}
                  onClick={() => handleFacingChange(opt.value)}
                >
                  <span className={styles.facingIconBox}>
                    <Icon name={opt.icon} size={26} />
                  </span>
                  <span>{opt.label}</span>
                  {facing === opt.value && <small>선택됨</small>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* STEP 2 — 미리보기 */}
        <div className={styles.step}>
          <span className={styles.stepNum}>2</span>
          <div className={styles.stepBody}>
            <div className={styles.stepHeading}>
              <p className={styles.stepTitle}>화면을 확인하세요</p>
              <span>
                {status === 'off' ? `${selectedSource} 미리보기를 먼저 켜주세요.` : '아래 화면이 그대로 송출됩니다.'}
              </span>
            </div>
            <div className={styles.videoBox}>
              <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
              <canvas ref={canvasRef} className={styles.hiddenCanvas} />
              <span className={styles.previewBadge}>{selectedSource}</span>
              {status === 'streaming' && <span className={styles.liveBadge}>LIVE</span>}
              {status === 'off' && (
                <div className={styles.videoPlaceholder}>
                  <span className={styles.placeholderIcon}>
                    <Icon name={facing === 'screen' ? 'monitor' : 'camera'} size={32} />
                  </span>
                  <strong>아직 미리보기가 꺼져 있어요</strong>
                  <span>아래 버튼을 눌러 화면을 확인하세요.</span>
                </div>
              )}
            </div>
            <div className={styles.mediaCtrl}>
              {status === 'off' ? (
                <button type="button" className={styles.btnPrimary} onClick={handleStartMedia}>
                  {facing === 'screen' ? (
                    <>
                      <Icon name="monitor" size={18} className={styles.btnIcon} /> 화면 미리보기 켜기
                    </>
                  ) : (
                    <>
                      <Icon name="camera" size={18} className={styles.btnIcon} /> 카메라 미리보기 켜기
                    </>
                  )}
                </button>
              ) : (
                <button type="button" className={styles.btnDanger} disabled={isStoppingLive} onClick={handleStopMedia}>
                  미리보기 끄기
                </button>
              )}
            </div>
          </div>
        </div>

        {/* STEP 3 — 송출 */}
        <div className={`${styles.step} ${status === 'off' ? styles.stepDisabled : ''}`}>
          <span className={styles.stepNum}>3</span>
          <div className={styles.stepBody}>
            <div className={styles.stepTitleRow}>
              <p className={styles.stepTitle}>보호자에게 송출하기</p>
              <span className={`${styles.statusDot} ${statusDot}`} aria-live="polite">
                {statusLabel}
              </span>
            </div>

            <details className={styles.streamSettings}>
              <summary>고급 송출 설정</summary>
              <div className={styles.settingsRow}>
                <label className={styles.settingField}>
                  <span>송출 이름</span>
                  <input
                    value={liveSessionName}
                    onChange={e => setLiveSessionName(e.target.value)}
                    disabled={status === 'streaming'}
                  />
                </label>
                <label className={styles.settingField}>
                  <span>Camera ID</span>
                  <input value={camId} onChange={e => setCamId(e.target.value)} disabled={status === 'streaming'} />
                </label>
                <label className={styles.settingField}>
                  <span>
                    FPS <strong>{fps}</strong>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={fps}
                    disabled={status === 'streaming'}
                    onChange={e => setFps(Number(e.target.value))}
                    className={styles.fpsSlider}
                  />
                </label>
              </div>
            </details>

            <div className={styles.streamCtrl}>
              {status !== 'streaming' ? (
                <button
                  type="button"
                  className={styles.btnStart}
                  disabled={status === 'off'}
                  onClick={handleStartStreaming}
                >
                  송출 시작
                </button>
              ) : (
                <button type="button" className={styles.btnStop} disabled={isStoppingLive} onClick={handleStopMedia}>
                  {isStoppingLive ? '송출을 종료하고 있어요' : '송출 종료'}
                </button>
              )}
              {status === 'streaming' && queueCount > 0 && (
                <span className={styles.queueBadge}>대기 {queueCount}장</span>
              )}
            </div>
            <p className={`${styles.stateGuide} ${status === 'streaming' ? styles.stateGuideLive : ''}`}>
              {status === 'off' && '먼저 미리보기를 켜서 화면을 확인하세요.'}
              {status === 'ready' && '아직 전송되지 않았습니다. 화면 확인 후 송출 시작을 눌러주세요.'}
              {status === 'streaming' && '현재 화면이 보호자에게 전송되고 있습니다.'}
            </p>

            {liveMsg && <p className={styles.errMsg}>{liveMsg}</p>}
          </div>
        </div>
      </div>

      <details className={styles.adminSection}>
        <summary className={styles.adminSummary}>
          <span className={styles.adminSummaryTitle}>
            <Icon name="settings" size={16} />
            <span>
              <strong>관리자 설정</strong>
              <small>일반적인 화면 송출에는 필요하지 않습니다.</small>
            </span>
          </span>
          <span className={styles.adminSummaryAction}>설정 열기</span>
        </summary>
        <div className={styles.adminContent}>
          <details className={styles.toolPanel}>
            <summary className={styles.toolSummary}>
              <Icon name="monitor" size={18} />
              <span>
                <strong>사진 파일 직접 보내기</strong>
                <small>카메라 대신 사진으로 송출 상태를 점검합니다.</small>
              </span>
            </summary>
            <div className={styles.manualPanel}>
              <div className={styles.manualGrid}>
                <label className={styles.field}>
                  <span>송출 이름</span>
                  <input value={manualSessionId} onChange={e => setManualSessionId(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>카메라 식별값</span>
                  <input value={manualCamId} onChange={e => setManualCamId(e.target.value)} />
                </label>
              </div>

              {activeSession && (
                <div className={styles.activeSessionBadge}>
                  전송 준비 완료: <strong>{activeSession}</strong>
                </div>
              )}

              <label className={styles.field}>
                <span>보낼 사진 선택</span>
                <input type="file" accept="image/jpeg" onChange={e => setManualFile(e.target.files?.[0] ?? null)} />
              </label>

              <div className={styles.manualBtns}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={manualLoading || !!activeSession}
                  onClick={handleCreateSession}
                >
                  전송 준비
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={manualLoading || !manualFile || !activeSession}
                  onClick={handleUploadFrame}
                >
                  선택한 사진 보내기
                </button>
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={manualLoading || !activeSession}
                  onClick={handleStopSession}
                >
                  전송 종료
                </button>
              </div>

              {manualMsg && <p className={styles.infoMsg}>{manualMsg}</p>}
            </div>
          </details>

          <details className={styles.toolPanel}>
            <summary className={styles.toolSummary}>
              <Icon name="gear" size={18} />
              <span>
                <strong>외부 카메라 장치 등록</strong>
                <small>별도 카메라를 연결할 때만 사용합니다.</small>
              </span>
            </summary>
            <form className={styles.camRegForm} onSubmit={handleCamReg}>
              <div className={styles.manualGrid}>
                {(
                  [
                    ['cameraNo', '카메라 번호', 'CAM-001'],
                    ['identifier', '카메라 식별값', 'ipad-room-001'],
                    ['name', '이름', '거실 카메라'],
                    ['streamUrl', '카메라 연결 주소', 'rtsp://...'],
                    ['targetUserId', '피보호자 ID', ''],
                    ['guardianUserId', '보호자 ID', ''],
                    ['locationName', '위치', '거실'],
                  ] as [keyof typeof camRegForm, string, string][]
                ).map(([key, label, ph]) => (
                  <label key={key} className={styles.field}>
                    <span>{label}</span>
                    <input
                      placeholder={ph}
                      value={String(camRegForm[key])}
                      onChange={e => setCamRegForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </label>
                ))}
                <label className={styles.field}>
                  <span>연결 방식</span>
                  <select
                    value={camRegForm.streamType}
                    onChange={e => setCamRegForm(f => ({ ...f, streamType: e.target.value }))}
                  >
                    <option value="rtsp">RTSP</option>
                    <option value="http">HTTP</option>
                    <option value="webrtc">WebRTC</option>
                  </select>
                </label>
              </div>
              {camRegMsg && (
                <p className={`${styles.infoMsg} ${camRegOk === false ? styles.errMsg : ''}`}>{camRegMsg}</p>
              )}
              <button type="submit" className={styles.btnPrimary}>
                카메라 등록
              </button>
            </form>
          </details>
        </div>
      </details>
    </div>
  );
}
