import classNames from 'classnames/bind';

import type { LiveStreamSession } from '@/service/interface/liveStream';
import { formatDateTime, formatRelativeDateTime } from './monitorUtils';
import styles from './SessionList.module.css';
const cx = classNames.bind(styles);


interface SessionListProps {
  error: unknown;
  isAllowlistEmpty: boolean;
  isError: boolean;
  isLoading: boolean;
  onSelectSession: (sessionId: string) => void;
  selectedId: string | null;
  sessions: LiveStreamSession[];
}

function getSessionCardTitle(session: LiveStreamSession) {
  const wardName = session.ward_name ?? '피보호자';
  return session.label ? `${wardName} · ${session.label}` : wardName;
}

export function SessionList({
  error,
  isAllowlistEmpty,
  isError,
  isLoading,
  onSelectSession,
  selectedId,
  sessions,
}: SessionListProps) {
  return (
    <aside className={cx('sessionPanel')}>
      <div className={cx('sessionPanelHeader')}>
        <strong>송출 세션</strong>
        <span>{sessions.length}</span>
      </div>

      {isLoading ? (
        <p className={cx('sessionEmpty')}>불러오는 중…</p>
      ) : isError ? (
        <p className={cx('sessionEmpty')}>
          불러오기 실패
          <br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>{(error as Error)?.message}</span>
        </p>
      ) : isAllowlistEmpty ? (
        <p className={cx('sessionEmpty')}>연결된 피보호자의 카메라가 없습니다.</p>
      ) : sessions.length === 0 ? (
        <p className={cx('sessionEmpty')}>현재 송출 중인 세션이 없습니다.</p>
      ) : (
        <ul className={cx('sessionList')}>
          {sessions.map(session => (
            <li key={session.session_id}>
              <button
                type="button"
                className={cx('sessionCard', { 'active': selectedId === session.session_id })}
                onClick={() => onSelectSession(session.session_id)}
              >
                <span className={cx('sessionCardTop')}>
                  <strong>{getSessionCardTitle(session)}</strong>
                  {session.is_analyzing && <span className={cx('analyzingBadge')}>AI 분석 중</span>}
                </span>
                <span className={cx('sessionTime')}>
                  {formatRelativeDateTime(session.started_at)}
                  <small>{formatDateTime(session.started_at)}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
