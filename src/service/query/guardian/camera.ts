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
