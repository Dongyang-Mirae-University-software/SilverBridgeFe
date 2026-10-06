'use client';

import { queryOptions, useMutation } from '@tanstack/react-query';

import {
  getGuardianCameraStatus,
  getGuardianCameras,
  getGuardianLiveCameras,
  issueGuardianCameraStreamTicket,
} from '@/service/api/guardian/camera';

export const guardianLiveCamerasQueryKey = ['guardian-live-cameras'] as const;
export const guardianCameraStatusQueryKey = ['guardian-camera-status'] as const;

/** @deprecated 백엔드 중계(`/live`)로 대체됨 — useGuardianMonitor 재작성 후 삭제 예정 */
export const guardianCamerasQueryKey = ['guardian-cameras'] as const;

/** @deprecated 백엔드 중계(`/live`)로 대체됨 — useGuardianMonitor 재작성 후 삭제 예정 */
export const guardianCamerasQueryOptions = queryOptions({
  queryKey: guardianCamerasQueryKey,
  queryFn: getGuardianCameras,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

export const guardianLiveCamerasQueryOptions = queryOptions({
  queryKey: guardianLiveCamerasQueryKey,
  queryFn: getGuardianLiveCameras,
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
