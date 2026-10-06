import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getLiveStreamLatestAnalysis, getLiveStreamStatus, getLiveStreams } from '@/service/api/liveStream';
import { stopStreamSession } from '@/service/api/streamSession';
import { connectLiveStreamSocket, type LiveStreamServerEvent } from '@/lib/realtime/liveStreamSocket';
import type { LiveStreamAnalysis, LiveStreamSession, LiveStreamStatus } from '@/service/interface/liveStream';
import { resolveDetectState } from '@/service/interface/liveStream';
import { guardianCamerasQueryOptions } from '@/service/query/guardian/camera';
import type { GuardianCameraAllowlistItem } from '@/service/interface/guardian/camera';
import { getEventSessionId, getLatestFrameUrl, normalizeAnalysis, normalizeSessions, normalizeStatus } from './monitorUtils';

// AI 서버는 전체 세션 목록을 계속 뿌리므로, 초기 조회 응답과 WebSocket live_streams
// 이벤트 양쪽 모두 이 허용 목록과 겹치는 세션만 남기고 이름·방이름을 붙인다
function filterToAllowlist(
  sessions: LiveStreamSession[],
  allowlist: Map<string, GuardianCameraAllowlistItem>,
): LiveStreamSession[] {
  return sessions
    .filter(session => allowlist.has(session.session_id))
    .map(session => {
      const allowed = allowlist.get(session.session_id)!;
      return { ...session, ward_name: allowed.wardName, label: allowed.label };
    });
}

export function useGuardianMonitor() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const socketRef = useRef<ReturnType<typeof connectLiveStreamSocket> | null>(null);
  const [socketStatus, setSocketStatus] = useState<LiveStreamStatus | null>(null);
  const [socketAnalysis, setSocketAnalysis] = useState<LiveStreamAnalysis | null>(null);
  const [latestFrameUrl, setLatestFrameUrl] = useState<string | null>(null);

  const { data: allowlist = [] } = useQuery(guardianCamerasQueryOptions);
  const allowlistMap = useMemo(
    () => new Map(allowlist.map(item => [item.sessionId, item])),
    [allowlist],
  );
  // WS 콜백(handleStreamEvent)은 useCallback으로 한 번만 만들어져서 그 안에서 allowlist를
  // 직접 참조하면 값이 고정돼 버린다 — ref로 항상 최신 허용 목록을 읽게 한다
  const allowlistRef = useRef(allowlistMap);
  useEffect(() => {
    allowlistRef.current = allowlistMap;
  }, [allowlistMap]);

  const { data: rawSessions = [], isLoading, isError, error } = useQuery({
    queryKey: ['liveStreams'],
    queryFn: getLiveStreams,
    refetchInterval: 15_000,
  });

  const sessions = filterToAllowlist(rawSessions, allowlistMap);

  const { data: status } = useQuery({
    queryKey: ['liveStreamStatus', selectedId],
    queryFn: () => getLiveStreamStatus(selectedId!),
    enabled: !!selectedId,
    staleTime: 10_000, // WS로 업데이트되므로 10초간 캐시 유지
  });

  const { data: analysis } = useQuery({
    queryKey: ['liveStreamAnalysis', selectedId],
    queryFn: () => getLiveStreamLatestAnalysis(selectedId!),
    enabled: !!selectedId,
    staleTime: 10_000,
  });

  const stopSessionMutation = useMutation({
    mutationFn: stopStreamSession,
    onSuccess: async (_, sessionId) => {
      const stoppedStatus: LiveStreamStatus = {
        ...(socketStatus ?? status ?? {}),
        session_id: sessionId,
        status: 'stopped',
      };

      setSocketStatus(stoppedStatus);
      queryClient.setQueryData(['liveStreamStatus', sessionId], stoppedStatus);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['liveStreams'] }),
        queryClient.invalidateQueries({ queryKey: ['liveStreamStatus', sessionId] }),
      ]);
    },
  });

  const handleStreamEvent = useCallback((event: LiveStreamServerEvent, currentSessionId: string | null) => {
    if (event.type === 'live_streams') {
      const nextSessions = normalizeSessions(event.data);
      // AI 서버는 전체 세션을 계속 뿌리므로 캐시에 쓰기 전에도 허용 목록으로 걸러야
      // 한다 — 초기 조회만 거르고 이 경로를 놓치면 허용 안 된 카메라가 다시 들어온다
      if (nextSessions) queryClient.setQueryData(['liveStreams'], filterToAllowlist(nextSessions, allowlistRef.current));
      return;
    }

    if (event.type === 'session_status') {
      const nextStatus = normalizeStatus(event.data);
      const sessionId = nextStatus?.session_id ?? currentSessionId;
      if (nextStatus && sessionId) {
        setSocketStatus(nextStatus);
        queryClient.setQueryData(['liveStreamStatus', sessionId], nextStatus);
      }
      return;
    }

    if (event.type === 'latest_analysis') {
      const nextAnalysis = normalizeAnalysis(event.data);
      const sessionId = getEventSessionId(event.data) ?? currentSessionId;
      if (nextAnalysis && sessionId) {
        setSocketAnalysis(nextAnalysis);
        setLatestFrameUrl(getLatestFrameUrl(nextAnalysis));
        queryClient.setQueryData(['liveStreamAnalysis', sessionId], nextAnalysis);
      }
    }
  }, [queryClient]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_STREAM_WS_URL;
    if (!wsUrl) return;

    const socket = connectLiveStreamSocket({
      wsUrl,
      onEvent: event => handleStreamEvent(event, selectedIdRef.current),
    });

    socketRef.current = socket;
    return () => socket.disconnect();
  }, [handleStreamEvent]);

  function selectSession(sessionId: string) {
    // 목록이 이미 허용 목록으로 걸러져 있지만, 구독 시점에도 한 번 더 확인(심층 방어)
    if (!allowlistRef.current.has(sessionId)) return;

    setSelectedId(sessionId);
    selectedIdRef.current = sessionId;
    setSocketStatus(null);
    setSocketAnalysis(null);
    setLatestFrameUrl(null);
    socketRef.current?.subscribe(sessionId);
  }

  function stopSelectedSession() {
    if (!selectedId || stopSessionMutation.isPending) return;
    stopSessionMutation.mutate(selectedId);
  }

  const selectedSession = sessions.find((session: LiveStreamSession) => session.session_id === selectedId);
  const sessionStatus = socketStatus ?? status ?? null;
  const latestAnalysis = socketAnalysis ?? analysis ?? null;
  const detectState = resolveDetectState(latestAnalysis);
  const mjpegSrc = selectedId ? `/api/streams/v1/live-streams/${selectedId}/mjpeg` : null;

  return {
    detectState,
    error,
    frameSrc: latestFrameUrl ?? mjpegSrc,
    isAllowlistEmpty: allowlist.length === 0,
    isError,
    isLoading,
    isStoppingSession: stopSessionMutation.isPending,
    latestAnalysis,
    latestFrameUrl,
    selectSession,
    selectedId,
    selectedSession,
    sessionStatus,
    sessions,
    stopSelectedSession,
    viewerUrl: selectedSession?.viewerUrl ?? selectedSession?.viewer_url ?? mjpegSrc,
  };
}
