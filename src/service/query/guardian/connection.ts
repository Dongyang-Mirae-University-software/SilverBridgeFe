import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  cancelGuardianConnectionRequest,
  getGuardianConnectionRequests,
  getGuardianConnections,
  requestWardConnection,
} from '@/service/api/guardian/connection';

export const guardianConnectionsQueryKey = ['guardian-connections'] as const;
export const guardianConnectionRequestsQueryKey = [...guardianConnectionsQueryKey, 'requests'] as const;

export const guardianConnectionsQueryOptions = queryOptions({
  queryKey: guardianConnectionsQueryKey,
  queryFn: () => getGuardianConnections(),
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

export const guardianConnectionRequestsQueryOptions = queryOptions({
  queryKey: guardianConnectionRequestsQueryKey,
  queryFn: getGuardianConnectionRequests,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

// 요청·취소 뒤에는 목록(/select)과 요청 이력(/requests)을 함께 새로 받는다(요청 이력 키가 목록 키 아래에 있다)
function useInvalidateGuardianConnections() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
}

export function useGuardianConnectionRequestMutation() {
  const invalidate = useInvalidateGuardianConnections();
  return useMutation({
    mutationKey: ['guardian-connection-request'],
    mutationFn: requestWardConnection,
    onSuccess: invalidate,
  });
}

// 수락 전(PENDING) 요청 취소 - 피보호자에게는 푸시 없이 화면 갱신 신호(connection-request-cancelled)만 간다
export function useGuardianConnectionCancelMutation() {
  const invalidate = useInvalidateGuardianConnections();
  return useMutation({
    mutationKey: ['guardian-connection-cancel'],
    mutationFn: cancelGuardianConnectionRequest,
    onSettled: invalidate,
  });
}
