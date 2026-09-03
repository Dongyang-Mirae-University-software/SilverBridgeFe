import { queryOptions } from '@tanstack/react-query';

import { getGuardianConnectionRequests, getGuardianConnections } from '@/service/api/guardian/connection';

export const guardianConnectionsQueryKey = ['guardian-connections'] as const;
export const guardianConnectionRequestsQueryKey = [...guardianConnectionsQueryKey, 'requests'] as const;

export const guardianConnectionsQueryOptions = queryOptions({
  queryKey: guardianConnectionsQueryKey,
  queryFn: getGuardianConnections,
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
