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

// 티켓 재발급을 너무 자주 시도하면 429(요청 과다)에 걸리므로 재연결 사이에 간격을 둔다
const TICKET_RETRY_DELAY_MS = 3000;

// 403(CAMERA_NOT_CONNECTED·INACTIVE_USER)·404(CAMERA_NOT_FOUND)는 재시도해도 안 풀리는
// 에러라서 자동 재연결을 멈춰야 한다 — 끄지 않으면 403 루프를 계속 돌게 된다
function isPermanentStreamError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 403 || status === 404;
}

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
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openStreamRef = useRef<(sessionId: string) => void>(() => {});

  const { data: sessions = [], isLoading, isError, error } = useQuery(guardianLiveCamerasQueryOptions);
  const { data: status } = useQuery(guardianCameraStatusQueryOptions(selectedId));
  const ticketMutation = useIssueGuardianCameraStreamTicketMutation();

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const openStream = useCallback(
    (sessionId: string) => {
      clearRetryTimer();
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

          // 권한 없음·존재하지 않는 카메라는 다시 시도해도 똑같이 실패하므로 멈춘다
          if (isPermanentStreamError(error)) return;

          retryTimerRef.current = setTimeout(() => {
            if (selectedIdRef.current === sessionId) openStreamRef.current(sessionId);
          }, TICKET_RETRY_DELAY_MS);
        },
      });
    },
    [clearRetryTimer, ticketMutation],
  );

  useEffect(() => {
    openStreamRef.current = openStream;
  }, [openStream]);

  // <img onError> — 티켓 만료(최대 30분)·일시적 끊김이면 새 티켓으로 조용히 재연결한다.
  // 진짜 원인(연결 해제·정지 계정 등)은 openStream의 티켓 재발급 응답에서 판가름난다
  const handleStreamError = useCallback(() => {
    const sessionId = selectedIdRef.current;
    if (!sessionId) return;
    setFrameSrc(null);
    clearRetryTimer();
    retryTimerRef.current = setTimeout(() => {
      if (selectedIdRef.current === sessionId) openStreamRef.current(sessionId);
    }, TICKET_RETRY_DELAY_MS);
  }, [clearRetryTimer]);

  function selectSession(sessionId: string) {
    if (!sessions.some(session => session.sessionId === sessionId)) return;

    clearRetryTimer();
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

  useEffect(() => clearRetryTimer, [clearRetryTimer]);

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
