'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { useGuardianMonitor } from './useGuardianMonitor';
import type { GuardianCameraLiveStatus, GuardianLiveCamera } from '@/service/interface/guardian/camera';
import styles from './LiveCameraModal.module.css';

const cx = classNames.bind(styles);

function useLiveClock() {
  // 현재 시각을 첫 SSR HTML에 넣으면 서버와 휴대폰의 렌더 시각이 달라 hydration 오류가 난다.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const updateClock = () => setNow(new Date());
    const initialTimer = setTimeout(updateClock, 0);
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, []);
  return now;
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
  const now = useLiveClock();

  useEffect(() => {
    if (didInitRef.current || monitor.isLoading || monitor.sessions.length === 0) return;
    didInitRef.current = true;
    const target =
      initialSessionId && monitor.sessions.some(session => session.sessionId === initialSessionId)
        ? initialSessionId
        : initialWardId
          ? monitor.sessions.find(session => session.wardId === initialWardId)?.sessionId
          : monitor.sessions[0].sessionId;
    if (target) monitor.selectSession(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId, initialWardId, monitor.isLoading, monitor.sessions]);

  const cameraStatus = monitor.sessionStatus?.status;
  const cameraStatusMeta = getCameraStatusMeta(cameraStatus ?? null);

  const wardGroups = useMemo(() => groupSessionsByWard(monitor.sessions), [monitor.sessions]);
  const selectedWardId = initialWardId || monitor.selectedSession?.wardId || monitor.selectedSession?.wardName || '';
  const selectedWardGroup = wardGroups.find(group => group.wardId === selectedWardId);
  const hasNoCameraForSelectedWard = Boolean(initialWardId) && !selectedWardGroup;
  const isVideoUnavailable =
    Boolean(monitor.streamErrorMessage) || cameraStatus === 'disconnected' || cameraStatus === 'offline';

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <div
        className={cx('modal')}
        role="dialog"
        aria-modal="true"
        aria-label="실시간 카메라"
        onClick={event => event.stopPropagation()}
      >
        <header className={cx('header')}>
          <span className={cx('liveBadge')}>
            <span className={cx('liveDot')} />
            LIVE
          </span>
          <strong>실시간 카메라{monitor.selectedSession?.label ? ` · ${monitor.selectedSession.label}` : ''}</strong>
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
            <div className={cx('placeholder')}>{monitor.streamErrorMessage ?? '프레임을 수신하는 중입니다...'}</div>
          ) : (
            <img
              key={monitor.frameSrc}
              src={monitor.frameSrc}
              alt="실시간 영상"
              className={cx('frameImg')}
              onError={monitor.onStreamError}
            />
          )}

          <div className={cx('recBadge')}>
            <strong>
              <span className={cx('recDot')} />
              REC
            </strong>
            <span>{now ? formatLiveDateTime(now) : '-'}</span>
            <span>CAM · {monitor.selectedSession?.label ?? '-'}</span>
          </div>
        </div>

        <div className={cx('connectionRow')}>
          <span>연결 상태</span>
          <strong className={cx('connectionBadge', cameraStatusMeta.tone)}>
            <span className={cx('connectionDot')} />
            {cameraStatusMeta.label}
          </strong>
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
          <button type="button" className={cx('closeFooterButton')} onClick={onClose}>
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}
