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

  // 세션 선택 — selectedId 변경 + WS subscribe 전송
  function handleSelectSession(sessionId: string) {
    setSelectedId(sessionId);
    socketRef.current?.subscribe(sessionId);
  }

  void sessions; void status; void analysis; void isLoading; void isError; void error;
  void handleSelectSession; void styles; void resolveDetectState;
  type _S = LiveStreamSession;

  return null;
}
