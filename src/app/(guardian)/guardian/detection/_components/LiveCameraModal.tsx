'use client';

import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { formatNumber } from './monitorUtils';
import { useGuardianMonitor } from './useGuardianMonitor';
import styles from './LiveCameraModal.module.css';

const cx = classNames.bind(styles);

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

function getCameraLabel(session: { wardName?: string; label?: string }) {
  if (session.label) return session.wardName ? `${session.wardName} · ${session.label}` : session.label;
  return session.wardName ?? '피보호자';
}

export function LiveCameraModal({ initialSessionId, onClose }: { initialSessionId?: string | null; onClose: () => void }) {
  const monitor = useGuardianMonitor();
  const didInitRef = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const now = useLiveClock();

  useEffect(() => {
    if (didInitRef.current || monitor.isLoading || monitor.sessions.length === 0) return;
    didInitRef.current = true;
    const target = initialSessionId && monitor.sessions.some(session => session.sessionId === initialSessionId)
      ? initialSessionId
      : monitor.sessions[0].sessionId;
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
  const detectLabel = DETECT_LABEL[monitor.detectState] ?? '분석 대기 중';
  const isAlert = ['fire', 'smoke', 'knife', 'fall', 'danger'].includes(monitor.detectState);
  const cameraStatus = monitor.sessionStatus?.status;
  const cameraStatusLabel = cameraStatus === null ? '확인 불가' : cameraStatus ?? '-';

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

        <div className={cx('frameArea')}>
          {monitor.isEmpty ? (
            <div className={cx('placeholder')}>연결된 피보호자의 카메라가 없습니다.</div>
          ) : !monitor.frameSrc ? (
            <div className={cx('placeholder')}>
              {monitor.streamErrorMessage ?? '프레임을 수신하는 중입니다...'}
            </div>
          ) : (
            <img
              ref={imgRef}
              key={monitor.frameSrc}
              src={monitor.frameSrc}
              alt="실시간 영상"
              className={cx('frameImg')}
              onError={monitor.onStreamError}
            />
          )}

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
              {monitor.latestAnalysis.detectedTypeLabel} · {detectLabel.toUpperCase()}
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
            <strong>{cameraStatusLabel}</strong>
          </div>
        </div>

        {monitor.sessions.length > 1 && (
          <div className={cx('switchRow')}>
            <span className={cx('switchLabel')}>카메라 전환</span>
            <div className={cx('switchChips')}>
              {monitor.sessions.map(session => (
                <button
                  key={session.sessionId}
                  type="button"
                  className={cx('switchChip', { active: monitor.selectedId === session.sessionId })}
                  onClick={() => monitor.selectSession(session.sessionId)}
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
