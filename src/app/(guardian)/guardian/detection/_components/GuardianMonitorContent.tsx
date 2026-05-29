'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getLiveStreamLatestAnalysis, getLiveStreamStatus, getLiveStreams } from '@/service/api/liveStream';
import { type LiveStreamServerEvent, connectLiveStreamSocket } from '@/lib/realtime/liveStreamSocket';
import type { LiveStreamSession } from '@/service/interface/liveStream';
import { resolveDetectState } from '@/service/interface/liveStream';

import styles from './GuardianMonitorContent.module.css';

export default function GuardianMonitorContent() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof connectLiveStreamSocket> | null>(null);

  const { data: sessions = [], isLoading, isError, error } = useQuery({
    queryKey: ['liveStreams'],
    queryFn: getLiveStreams,
    refetchInterval: 15_000,
  });

  const { data: status } = useQuery({
    queryKey: ['liveStreamStatus', selectedId],
    queryFn: () => getLiveStreamStatus(selectedId!),
    enabled: !!selectedId,
  });

  const { data: analysis } = useQuery({
    queryKey: ['liveStreamAnalysis', selectedId],
    queryFn: () => getLiveStreamLatestAnalysis(selectedId!),
    enabled: !!selectedId,
  });

  // WebSocket 연결 — live_streams/session_status/latest_analysis 이벤트로 쿼리 무효화
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_STREAM_WS_URL;
    if (!wsUrl) return;

    const socket = connectLiveStreamSocket({
      wsUrl,
      onEvent: (event: LiveStreamServerEvent) => {
        if (event.type === 'live_streams') {
          void queryClient.invalidateQueries({ queryKey: ['liveStreams'] });
        } else if (event.type === 'session_status') {
          void queryClient.invalidateQueries({ queryKey: ['liveStreamStatus', selectedId] });
        } else if (event.type === 'latest_analysis') {
          void queryClient.invalidateQueries({ queryKey: ['liveStreamAnalysis', selectedId] });
        }
      },
    });

    socketRef.current = socket;
    return () => socket.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  // 세션 선택 — selectedId 변경 + WS subscribe 액션 전송
  function handleSelectSession(sessionId: string) {
    setSelectedId(sessionId);
    socketRef.current?.subscribe(sessionId);
  }

  const selectedSession = sessions.find((s: LiveStreamSession) => s.session_id === selectedId);
  const detectState = resolveDetectState(analysis);
  const mjpegSrc = selectedId ? `/api/streams/v1/live-streams/${selectedId}/mjpeg` : null;

  return (
    <div className={styles.monitorPage}>
      {/* 세션 목록 패널 */}
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
            {sessions.map((session: LiveStreamSession) => (
              <li key={session.session_id}>
                <button
                  type="button"
                  className={`${styles.sessionCard} ${selectedId === session.session_id ? styles.active : ''}`}
                  onClick={() => handleSelectSession(session.session_id)}
                >
                  <strong>{session.ward_name ?? '피보호자'}</strong>
                  <span className={styles.sessionId}>{session.session_id.slice(0, 8)}…</span>
                  {session.is_analyzing && <span className={styles.analyzingBadge}>AI 분석 중</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* 뷰어 패널 — 세션 미선택 빈 상태 */}
      <div className={styles.viewerPanel}>
        {!selectedId ? (
          <div className={styles.emptyState}>
            <p>좌측에서 세션을 선택하면<br />실시간 화면을 볼 수 있습니다.</p>
          </div>
        ) : (
          <>
            {void selectedSession}{void detectState}{void mjpegSrc}{void status}
          </>
        )}
      </div>
    </div>
  );
}
