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
import { getStreamResumeAction, resolveCameraDetectState } from './monitorUtils';

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
  // 보고 있는 카메라가 끊겼다 다시 켜지면(피보호자가 '카메라 끄기' 뒤 다시 켬) 새 티켓으로 영상을 다시 연다.
  // 예전 주소를 그대로 다시 쓰면 1회용 티켓이 이미 소비돼 거절되고, 배지는 '연결됨'인데 영상이 오지 않았다.
  const liveStatus = status?.status;
  const previousLiveRef = useRef<{ sessionId: string | null; status: typeof liveStatus }>({
    sessionId: null,
    status: undefined,
  });
  useEffect(() => {
    const next = { sessionId: selectedId, status: liveStatus };
    const action = getStreamResumeAction(previousLiveRef.current, next);
    previousLiveRef.current = next;
    if (action === 'drop') {
      setFrameSrc(null);
    } else if (action === 'reopen' && selectedId) {
      setFrameSrc(null);
      setStreamErrorMessage(null);
      openStream(selectedId);
    }
    // openStream 은 mutation 객체가 바뀔 때마다 새로 만들어져, 의존성에 넣으면 상태 변화 없이도 다시 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, liveStatus]);

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
