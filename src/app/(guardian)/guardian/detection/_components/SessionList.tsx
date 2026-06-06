import clsx from 'clsx';

import type { LiveStreamSession } from '@/service/interface/liveStream';
import { formatDateTime, formatRelativeDateTime } from './monitorUtils';
import styles from './SessionList.module.css';


interface SessionListProps {
  error: unknown;
  isError: boolean;
  isLoading: boolean;
  onSelectSession: (sessionId: string) => void;
  selectedId: string | null;
  sessions: LiveStreamSession[];
}

export function SessionList({ error, isError, isLoading, onSelectSession, selectedId, sessions }: SessionListProps) {
  return (
    <aside className={styles.sessionPanel}>
      <div className={styles.sessionPanelHeader}>
        <strong>송출 세션</strong>
        <span>{sessions.length}</span>
      </div>

      {isLoading ? (
        <p className={styles.sessionEmpty}>불러오는 중…</p>
      ) : isError ? (
        <p className={styles.sessionEmpty}>
          불러오기 실패
          <br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>{(error as Error)?.message}</span>
        </p>
      ) : sessions.length === 0 ? (
        <p className={styles.sessionEmpty}>현재 송출 중인 세션이 없습니다.</p>
      ) : (
        <ul className={styles.sessionList}>
          {sessions.map(session => (
            <li key={session.session_id}>
              <button
                type="button"
                className={clsx(styles.sessionCard, { [styles.active]: selectedId === session.session_id })}
                onClick={() => onSelectSession(session.session_id)}
              >
                <span className={styles.sessionCardTop}>
                  <strong>{session.ward_name ?? '피보호자'}</strong>
                  {session.is_analyzing && <span className={styles.analyzingBadge}>AI 분석 중</span>}
                </span>
                <span className={styles.sessionId}>{session.session_id}</span>
                <span className={styles.sessionTime}>
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
