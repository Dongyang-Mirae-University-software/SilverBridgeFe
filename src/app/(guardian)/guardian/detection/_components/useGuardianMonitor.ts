import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { ConnectionRealtimePayload } from '@/lib/realtime/connectionSocket';
import { getGuardianCameraStreamUrl } from '@/service/api/guardian/camera';
import {
  guardianCameraStatusQueryKey,
  guardianCameraStatusQueryOptions,
  guardianLiveCamerasQueryOptions,
  useIssueGuardianCameraStreamTicketMutation,
} from '@/service/query/guardian/camera';
import type {
  GuardianCameraAnalysis,
  GuardianCameraLiveStatus,
  GuardianCameraStatus,
} from '@/service/interface/guardian/camera';
import { resolveCameraDetectState } from './monitorUtils';

function getStreamErrorMessage(error: unknown) {
  return (error as { message?: string })?.message ?? '영상을 불러오지 못했습니다.';
}

function toAnalysis(payload: ConnectionRealtimePayload): GuardianCameraAnalysis | null {
  if (!payload.detectedType) return null;

  return {
    detectedType: payload.detectedType,
    detectedTypeLabel: payload.detectedTypeLabel ?? payload.detectedType,
    confidence: payload.confidence ? Number(payload.confidence) : 0,
    danger: payload.danger === 'true',
    analyzedAt: payload.analyzedAt ?? '',
  };
}

export function useGuardianMonitor() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [socketAnalysis, setSocketAnalysis] = useState<GuardianCameraAnalysis | null>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [streamErrorMessage, setStreamErrorMessage] = useState<string | null>(null);

  const { data: sessions = [], isLoading, isError, error } = useQuery(guardianLiveCamerasQueryOptions);
  const { data: status } = useQuery(guardianCameraStatusQueryOptions(selectedId));
  const ticketMutation = useIssueGuardianCameraStreamTicketMutation();

  const openStream = useCallback(
    (sessionId: string) => {
      ticketMutation.mutate(sessionId, {
        onSuccess: ticket => {
          // 그 사이 다른 카메라로 전환됐으면 이 응답은 버린다
          if (!ticket || selectedIdRef.current !== sessionId) return;
          setStreamErrorMessage(null);
          setFrameSrc(getGuardianCameraStreamUrl(sessionId, ticket.ticket));
        },
        onError: error => {
          if (selectedIdRef.current !== sessionId) return;
          setStreamErrorMessage(getStreamErrorMessage(error));
        },
      });
    },
    [ticketMutation],
  );

  // 티켓은 카메라를 선택할 때 한 번만 발급한다. MJPEG 연결 오류는 티켓을 재발급하지
  // 않는다. 자동 재시도는 짧은 오류에도 티켓 요청을 반복하게 만들어 서버 부담과
  // 요청 한도 초과를 유발한다.
  const handleStreamError = useCallback(() => {
    setFrameSrc(null);
    setStreamErrorMessage('영상 연결이 종료됐습니다. 실시간 카메라를 다시 열어 주세요.');
  }, []);

  function selectSession(sessionId: string) {
    if (!sessions.some(session => session.sessionId === sessionId)) return;

    setFrameSrc(null); // 동시 시청 한도(1인 2개)에 걸리지 않도록 이전 영상 연결부터 끊는다
    setSocketAnalysis(null);
    setStreamErrorMessage(null);
    setSelectedId(sessionId);
    selectedIdRef.current = sessionId;
    openStream(sessionId);
  }

  useEffect(() => {
    const handleCameraAnalysis = (event: Event) => {
      const payload = (event as CustomEvent<ConnectionRealtimePayload>).detail;
      if (!payload || payload.sessionId !== selectedIdRef.current) return;

      const analysis = toAnalysis(payload);
      if (analysis) setSocketAnalysis(analysis);

      if (payload.status !== undefined) {
        queryClient.setQueryData<GuardianCameraStatus>(
          [...guardianCameraStatusQueryKey, payload.sessionId],
          current => ({
            status: (payload.status ?? null) as GuardianCameraLiveStatus,
            lastFrameAt: current?.lastFrameAt ?? null,
            fps: current?.fps ?? null,
            isAnalyzing: current?.isAnalyzing ?? false,
            analysis: analysis ?? current?.analysis ?? null,
          }),
        );
      }
    };

    window.addEventListener('careai:camera-analysis', handleCameraAnalysis);
    return () => window.removeEventListener('careai:camera-analysis', handleCameraAnalysis);
  }, [queryClient]);

  const selectedSession = sessions.find(session => session.sessionId === selectedId) ?? null;
  const latestAnalysis = socketAnalysis ?? status?.analysis ?? null;
  const detectState = resolveCameraDetectState(latestAnalysis);

  return {
    detectState,
    error,
    frameSrc,
    isEmpty: !isLoading && sessions.length === 0,
    isError,
    isLoading,
    isStreamConnecting: ticketMutation.isPending,
    latestAnalysis,
    onStreamError: handleStreamError,
    selectSession,
    selectedId,
    selectedSession,
    sessionStatus: status ?? null,
    sessions,
    streamErrorMessage,
  };
}
