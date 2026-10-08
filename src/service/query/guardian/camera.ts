'use client';

import { queryOptions, useMutation } from '@tanstack/react-query';

import {
  getGuardianCameraStatus,
  getGuardianLiveCameras,
  issueGuardianCameraStreamTicket,
} from '@/service/api/guardian/camera';

export const guardianLiveCamerasQueryKey = ['guardian-live-cameras'] as const;
export const guardianCameraStatusQueryKey = ['guardian-camera-status'] as const;

export const guardianLiveCamerasQueryOptions = queryOptions({
  queryKey: guardianLiveCamerasQueryKey,
  queryFn: getGuardianLiveCameras,
  // 피보호자 기기에서 방 이름을 바꾼 경우에도 보호자가 실시간 보기 모달을 다시
  // 열거나 화면으로 돌아오면 캐시를 쓰지 않고 서버의 최신 라벨을 받는다.
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  refetchInterval: 15 * 1000,
  staleTime: 10 * 1000,
});

export function guardianCameraStatusQueryOptions(sessionId: string | null) {
  return queryOptions({
    queryKey: [...guardianCameraStatusQueryKey, sessionId] as const,
    queryFn: () => getGuardianCameraStatus(sessionId as string),
    enabled: !!sessionId,
    staleTime: 10 * 1000,
  });
}

export function useIssueGuardianCameraStreamTicketMutation() {
  return useMutation({
    mutationKey: ['guardian-camera-stream-ticket'],
    mutationFn: (sessionId: string) => issueGuardianCameraStreamTicket(sessionId),
  });
}
