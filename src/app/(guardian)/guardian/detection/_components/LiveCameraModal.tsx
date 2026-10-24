'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { needsReselect, pickInitialSessionId } from './monitorUtils';
import { useGuardianMonitor } from './useGuardianMonitor';
import type { GuardianCameraLiveStatus, GuardianLiveCamera } from '@/service/interface/guardian/camera';
import styles from './LiveCameraModal.module.css';

const cx = classNames.bind(styles);

// MJPEG 영상. 화면에서 빠질 때(카메라 전환·모달 닫기·영상 없음 표시) src 속성을 지워 브라우저가 영상 연결을
// 끊게 한다 - <img>를 DOM에서 빼기만 하면 연결이 남아 서버 중계가 30분 상한까지 이어지고, 동시 시청 자리(1인 2개)를
// 차지해 다음 영상이 '동시 시청 상한'으로 거절된다. 속성을 지우는 방식은 error 이벤트를 내지 않는다.
function MjpegFrame({ src, className, onError }: { src: string; className?: string; onError: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    return () => img?.removeAttribute('src');
  }, [src]);

  return (
    <img ref={imgRef} src={src} alt="실시간 영상" className={className} onError={onError} />
  );
}

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

// 카메라 상태는 '켜짐/꺼짐' 두 말로만 보인다(2026-10-15 시안 - '연결 상태'와 버튼 상태가 따로 보여 헷갈렸다).
// 모르면(null) '확인 중'. 피보호자 '내 카메라' 카드와 같은 말을 쓴다.
function getCameraStatusMeta(status: GuardianCameraLiveStatus) {
  if (status === 'running') return { label: '켜짐', tone: 'running' } as const;
  if (status === null) return { label: '확인 중', tone: 'checking' } as const;
  return { label: '꺼짐', tone: 'offline' } as const;
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

  // 처음 열 때, 그리고 보던 카메라가 목록에서 사라졌을 때(등록 해제 후 재등록 등) 카메라를 고른다.
  // 지정 카메라(initialSessionId)는 처음 한 번만 따른다.
  useEffect(() => {
    if (monitor.isLoading || !needsReselect(monitor.sessions, monitor.selectedId)) return;
    const target = pickInitialSessionId(monitor.sessions, didInitRef.current ? null : initialSessionId, initialWardId);
    didInitRef.current = true;
    if (target) monitor.selectSession(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId, initialWardId, monitor.isLoading, monitor.sessions, monitor.selectedId]);

  const cameraStatus = monitor.sessionStatus?.status;

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
            <div className={cx('videoUnavailable')}>
              <strong>연결된 피보호자의 카메라가 없어요</strong>
              <span>피보호자 기기에서 &apos;이 기기를 카메라로 등록&apos;을 하면 볼 수 있어요</span>
            </div>
          ) : monitor.streamErrorMessage ? (
            // 서버 안내를 그대로 보인다(동시 시청 상한 429·영상 연결 만료 등 - 일반 문구로 덮으면 이유를 모른다)
            <div className={cx('videoUnavailable')}>
              <strong>영상을 열 수 없어요</strong>
              <span>{monitor.streamErrorMessage}</span>
            </div>
          ) : isVideoUnavailable ? (
            <div className={cx('videoUnavailable')}>
              <strong>영상이 오지 않아요</strong>
              <span>카메라로 쓰는 기기의 화면을 켜 두세요</span>
            </div>
          ) : !monitor.frameSrc ? (
            cameraStatus === null ? (
              // 상태를 모르면(AI 연결 끊김 등) 켜짐·꺼짐으로 채우지 않는다
              <div className={cx('videoUnavailable')}>
                <strong>연결 상태를 확인하고 있어요</strong>
                <span>잠시 후 다시 확인해 주세요</span>
              </div>
            ) : (
              <div className={cx('placeholder')}>영상을 불러오는 중이에요...</div>
            )
          ) : (
            <MjpegFrame
              key={monitor.frameSrc}
              src={monitor.frameSrc}
              className={cx('frameImg')}
              onError={monitor.onStreamError}
            />
          )}

          <div className={cx('timeBadge')}>{now ? formatLiveDateTime(now) : '-'}</div>
        </div>

        {selectedWardGroup && (
          <div className={cx('switchRow')}>
            <div className={cx('switchChips')} role="group" aria-label="카메라 전환">
              {selectedWardGroup.cameras.map(session => {
                const isSelected = monitor.selectedId === session.sessionId;
                // 보고 있는 카메라는 목록(15초 간격)보다 최신인 상태 조회 값을 쓴다 - 화면과 버튼이 어긋나지 않게
                const status = getCameraStatusMeta(isSelected && cameraStatus !== undefined ? cameraStatus : session.status);
                return (
                  <button
                    key={session.sessionId}
                    type="button"
                    className={cx('switchChip', { active: isSelected })}
                    onClick={() => monitor.selectSession(session.sessionId)}
                  >
                    <span className={cx('switchStatusDot', status.tone)} />
                    {session.label}
                    {status.tone !== 'running' && <span className={cx('switchStatus')}>{status.label}</span>}
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
