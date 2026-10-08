'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { formatNumber } from './monitorUtils';
import { useGuardianMonitor } from './useGuardianMonitor';
import type { GuardianCameraLiveStatus, GuardianLiveCamera } from '@/service/interface/guardian/camera';
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

function getCameraStatusMeta(status: GuardianCameraLiveStatus) {
  if (status === 'running') return { label: '연결됨', tone: 'running' } as const;
  if (status === null) return { label: '확인 중', tone: 'checking' } as const;
  return { label: '연결 안 됨', tone: 'offline' } as const;
}

function formatLiveDateTime(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

interface WardGroup {
  wardId: string;
  wardName: string;
  cameras: GuardianLiveCamera[];
}

function groupSessionsByWard(sessions: GuardianLiveCamera[]): WardGroup[] {
  const groups: WardGroup[] = [];
  const indexByWardId = new Map<string, number>();

  sessions.forEach(session => {
    const wardId = session.wardId || session.wardName || session.sessionId;
    const existingIndex = indexByWardId.get(wardId);

    if (existingIndex === undefined) {
      indexByWardId.set(wardId, groups.length);
      groups.push({ wardId, wardName: session.wardName || '피보호자', cameras: [session] });
    } else {
      groups[existingIndex].cameras.push(session);
    }
  });

  return groups;
}

export function LiveCameraModal({
  initialSessionId,
  initialWardId,
  onClose,
}: {
  initialSessionId?: string | null;
  initialWardId?: string;
  onClose: () => void;
}) {
  const monitor = useGuardianMonitor();
  const didInitRef = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const now = useLiveClock();

  useEffect(() => {
    if (didInitRef.current || monitor.isLoading || monitor.sessions.length === 0) return;
    didInitRef.current = true;
    const target = initialSessionId && monitor.sessions.some(session => session.sessionId === initialSessionId)
      ? initialSessionId
      : initialWardId
        ? monitor.sessions.find(session => session.wardId === initialWardId)?.sessionId
        : monitor.sessions[0].sessionId;
    if (target) monitor.selectSession(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId, initialWardId, monitor.isLoading, monitor.sessions]);

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
  const cameraStatus = monitor.sessionStatus?.status;
  const cameraStatusLabel = cameraStatus === null ? '확인 불가' : cameraStatus ?? '-';
  const cameraStatusMeta = getCameraStatusMeta(cameraStatus ?? null);

  const wardGroups = useMemo(() => groupSessionsByWard(monitor.sessions), [monitor.sessions]);
  const selectedWardId = initialWardId || monitor.selectedSession?.wardId || monitor.selectedSession?.wardName || '';
  const selectedWardGroup = wardGroups.find(group => group.wardId === selectedWardId);
  const hasNoCameraForSelectedWard = Boolean(initialWardId) && !selectedWardGroup;
  const isVideoUnavailable = Boolean(monitor.streamErrorMessage) || cameraStatus === 'disconnected' || cameraStatus === 'offline';

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <div className={cx('modal')} role="dialog" aria-modal="true" aria-label="실시간 카메라" onClick={event => event.stopPropagation()}>
        <header className={cx('header')}>
          <span className={cx('liveBadge')}>
            <span className={cx('liveDot')} />
            LIVE
          </span>
          <strong>실시간 카메라{monitor.selectedSession ? ` — ${getCameraLabel(monitor.selectedSession)}` : ''}</strong>
          <button type="button" className={cx('closeButton')} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <div className={cx('frameArea')}>
          {monitor.isEmpty || hasNoCameraForSelectedWard ? (
            <div className={cx('placeholder')}>연결된 피보호자의 카메라가 없습니다.</div>
          ) : isVideoUnavailable ? (
            <div className={cx('videoUnavailable')}>
              <strong>영상이 오지 않아요</strong>
              <span>카메라로 쓰는 기기의 화면이 켜져 있는지 확인해 주세요</span>
            </div>
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
            <strong><span className={cx('recDot')} />REC</strong>
            <span>{formatLiveDateTime(now)}</span>
            <span>CAM · {monitor.selectedSession?.label ?? '-'}</span>
          </div>
          <div className={cx('aiBadge')}>
            <span className={cx('aiDot', cameraStatusMeta.tone)} />
            {cameraStatusMeta.label}
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

        {selectedWardGroup && (
          <div className={cx('switchRow')}>
            <span className={cx('switchLabel')}>카메라 전환</span>
            <div className={cx('switchChips')}>
              {selectedWardGroup.cameras.map(session => {
                const status = getCameraStatusMeta(session.status);
                return (
                  <button
                    key={session.sessionId}
                    type="button"
                    className={cx('switchChip', { active: monitor.selectedId === session.sessionId })}
                    onClick={() => monitor.selectSession(session.sessionId)}
                  >
                    <span className={cx('switchStatusDot', status.tone)} />
                    {session.label}
                    <span className={cx('switchStatus')}>{status.label}</span>
                  </button>
                );
              })}
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
