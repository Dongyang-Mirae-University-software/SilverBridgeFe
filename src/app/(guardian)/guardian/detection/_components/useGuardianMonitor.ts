import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getLiveStreamLatestAnalysis, getLiveStreamStatus, getLiveStreams } from '@/service/api/liveStream';
import { stopStreamSession } from '@/service/api/streamSession';
import { connectLiveStreamSocket, type LiveStreamServerEvent } from '@/lib/realtime/liveStreamSocket';
import type { LiveStreamAnalysis, LiveStreamSession, LiveStreamStatus } from '@/service/interface/liveStream';
import { resolveDetectState } from '@/service/interface/liveStream';
import { getEventSessionId, getLatestFrameUrl, normalizeAnalysis, normalizeSessions, normalizeStatus } from './monitorUtils';

export function useGuardianMonitor() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const socketRef = useRef<ReturnType<typeof connectLiveStreamSocket> | null>(null);
  const [socketStatus, setSocketStatus] = useState<LiveStreamStatus | null>(null);
  const [socketAnalysis, setSocketAnalysis] = useState<LiveStreamAnalysis | null>(null);
  const [latestFrameUrl, setLatestFrameUrl] = useState<string | null>(null);

  const { data: sessions = [], isLoading, isError, error } = useQuery({
    queryKey: ['liveStreams'],
    queryFn: getLiveStreams,
    refetchInterval: 15_000,
  });

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

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const handleStreamEvent = useCallback((event: LiveStreamServerEvent, currentSessionId: string | null) => {
    if (event.type === 'live_streams') {
      const nextSessions = normalizeSessions(event.data);
      if (nextSessions) queryClient.setQueryData(['liveStreams'], nextSessions);
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
