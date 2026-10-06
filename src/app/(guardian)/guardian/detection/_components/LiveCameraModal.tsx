'use client';

import { CSSProperties, RefObject, useEffect, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import type { LiveStreamDetectionBox } from '@/service/interface/liveStream';
import { formatNumber, normalizeDetectedType } from './monitorUtils';
import { useGuardianMonitor } from './useGuardianMonitor';
import styles from './LiveCameraModal.module.css';

const cx = classNames.bind(styles);

interface CoverTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

// object-fit: cover로 표시되는 <img> 위에 bbox를 정확히 겹치려면, 원본(naturalWidth/Height)
// 기준 좌표를 "꽉 채우며 잘리는" 변환으로 옮겨야 한다 — 그냥 비율만 곱하면 잘린 영역만큼 밀려서 어긋남
function useCoverTransform(
  containerRef: RefObject<HTMLElement | null>,
  imgRef: RefObject<HTMLImageElement | null>,
  // img가 key 변경으로 다시 마운트될 때(프레임/세션 전환) 새 DOM 노드를 다시 잡기 위한 트리거
  frameKey: unknown,
) {
  const [transform, setTransform] = useState<CoverTransform | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;

    const recompute = () => {
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      if (!naturalWidth || !naturalHeight) return;

      const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
      if (!containerWidth || !containerHeight) return;

      const scale = Math.max(containerWidth / naturalWidth, containerHeight / naturalHeight);
      setTransform({
        scale,
        offsetX: (containerWidth - naturalWidth * scale) / 2,
        offsetY: (containerHeight - naturalHeight * scale) / 2,
      });
    };

    recompute();

    const resizeObserver = new ResizeObserver(recompute);
    resizeObserver.observe(container);
    img.addEventListener('load', recompute);

    return () => {
      resizeObserver.disconnect();
      img.removeEventListener('load', recompute);
    };
  }, [containerRef, imgRef, frameKey]);

  return transform;
}

function getDetectionBoxStyle(bbox: LiveStreamDetectionBox, transform: CoverTransform): CSSProperties {
  return {
    left: bbox.x1 * transform.scale + transform.offsetX,
    top: bbox.y1 * transform.scale + transform.offsetY,
    width: (bbox.x2 - bbox.x1) * transform.scale,
    height: (bbox.y2 - bbox.y1) * transform.scale,
  };
}

const DETECT_LABEL: Record<string, string> = {
  fire: '화재 감지됨',
  smoke: '연기 감지됨',
  knife: '흉기 발견',
  fall: '낙상 감지됨',
  person: '사람 감지됨',
  danger: '위험 감지됨',
  safe: '이상 없음',
};

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function getCameraLabel(session: { ward_name?: string; label?: string }) {
  if (session.label) return session.ward_name ? `${session.ward_name} · ${session.label}` : session.label;
  return session.ward_name ?? '피보호자';
}

export function LiveCameraModal({ initialSessionId, onClose }: { initialSessionId?: string | null; onClose: () => void }) {
  const monitor = useGuardianMonitor();
  const didInitRef = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const frameAreaRef = useRef<HTMLDivElement>(null);
  const now = useLiveClock();
  const frameKey = monitor.latestFrameUrl ?? monitor.selectedId;
  const coverTransform = useCoverTransform(frameAreaRef, imgRef, frameKey);
  const detections = monitor.latestAnalysis?.detections ?? [];

  useEffect(() => {
    if (didInitRef.current || monitor.isLoading || monitor.sessions.length === 0) return;
    didInitRef.current = true;
    const target = initialSessionId && monitor.sessions.some(session => session.session_id === initialSessionId)
      ? initialSessionId
      : monitor.sessions[0].session_id;
    monitor.selectSession(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId, monitor.isLoading, monitor.sessions]);

  const handleSnapshot = () => {
    const img = imgRef.current;
    if (!img || !img.src) return;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 640;
    canvas.height = img.naturalHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const link = document.createElement('a');
    link.download = `snapshot-${monitor.selectedId ?? 'camera'}-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  const confidence = monitor.latestAnalysis?.confidence ?? 0;
  const detectedType = monitor.latestAnalysis ? normalizeDetectedType(monitor.latestAnalysis) : null;
  const detectLabel = DETECT_LABEL[monitor.detectState] ?? '분석 대기 중';
  const isAlert = ['fire', 'smoke', 'knife', 'fall', 'danger'].includes(monitor.detectState);

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <div className={cx('modal')} role="dialog" aria-modal="true" aria-label="실시간 카메라" onClick={event => event.stopPropagation()}>
        <header className={cx('header')}>
          <span className={cx('liveBadge')}>● LIVE</span>
          <strong>실시간 카메라{monitor.selectedSession ? ` — ${getCameraLabel(monitor.selectedSession)}` : ''}</strong>
          <button type="button" className={cx('closeButton')} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={cx('frameArea')} ref={frameAreaRef}>
          {monitor.isAllowlistEmpty ? (
            <div className={cx('placeholder')}>연결된 피보호자의 카메라가 없습니다.</div>
          ) : !monitor.frameSrc ? (
            <div className={cx('placeholder')}>프레임을 수신하는 중입니다...</div>
          ) : (
            <img ref={imgRef} key={frameKey} src={monitor.frameSrc} alt="실시간 영상" className={cx('frameImg')} />
          )}

          {coverTransform &&
            detections.map((detection, index) => {
              if (!detection.bbox) return null;
              const boxStyle = getDetectionBoxStyle(detection.bbox, coverTransform);
              const labelOnTop = (boxStyle.top as number) >= 24;

              return (
                <div key={index} className={cx('detectionBox')} style={boxStyle}>
                  {detection.detectedType && (
                    <span className={cx('detectionLabel', { labelInside: !labelOnTop })}>
                      {detection.detectedType.toUpperCase()}
                      {detection.confidence != null ? ` ${Math.round(detection.confidence * 100)}%` : ''}
                    </span>
                  )}
                </div>
              );
            })}

          <div className={cx('recBadge')}>
            <span className={cx('recDot')} />
            REC · {now.toLocaleString('ko-KR', { hour12: false })}
          </div>
          <div className={cx('aiBadge', { alert: isAlert })}>
            <span className={cx('aiDot')} />
            {isAlert ? `AI 감지: ${detectLabel}` : 'AI 감지 정상'}
          </div>

          {monitor.latestAnalysis && (
            <p className={cx('caption')}>
              {detectedType?.toUpperCase()} · {detectLabel.toUpperCase()}
            </p>
          )}
        </div>

        <div className={cx('infoRow')}>
          <div className={cx('infoChip')}>
            <span>신뢰도</span>
            <strong>{Math.round(confidence * 100)}%</strong>
          </div>
          <div className={cx('infoChip')}>
            <span>FPS</span>
            <strong>{formatNumber(monitor.sessionStatus?.fps)}</strong>
          </div>
          <div className={cx('infoChip')}>
            <span>상태</span>
            <strong>{monitor.sessionStatus?.status ?? '-'}</strong>
          </div>
        </div>

        {monitor.sessions.length > 1 && (
          <div className={cx('switchRow')}>
            <span className={cx('switchLabel')}>카메라 전환</span>
            <div className={cx('switchChips')}>
              {monitor.sessions.map(session => (
                <button
                  key={session.session_id}
                  type="button"
                  className={cx('switchChip', { active: monitor.selectedId === session.session_id })}
                  onClick={() => monitor.selectSession(session.session_id)}
                >
                  {getCameraLabel(session)}
                </button>
              ))}
            </div>
          </div>
        )}

        <footer className={cx('footer')}>
          <button type="button" className={cx('snapshotButton')} disabled={!monitor.frameSrc} onClick={handleSnapshot}>
            스냅샷 저장
          </button>
          <button type="button" className={cx('closeFooterButton')} onClick={onClose}>
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}
