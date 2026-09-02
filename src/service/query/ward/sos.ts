'use client';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { getWardActiveConnections } from '@/service/api/ward/connection';
import { triggerWardSos } from '@/service/api/ward/sos';
import { reportNonApiError } from '@/lib/api/reportError';

export const wardActiveConnectionsQueryKey = ['ward-active-connections'] as const;
export const wardSosMutationKey = ['ward-sos-trigger'] as const;

export const wardActiveConnectionsQueryOptions = queryOptions({
  queryKey: wardActiveConnectionsQueryKey,
  queryFn: async () => {
    const response = await getWardActiveConnections();
    return response.data?.data ?? [];
  },
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

export function useWardSosMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: wardSosMutationKey,
    mutationFn: triggerWardSos,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: wardActiveConnectionsQueryKey });
    },
    onError: error => reportNonApiError('SOS 전송 실패:', error),
  });
}
