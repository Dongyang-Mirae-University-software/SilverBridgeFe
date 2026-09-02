import { queryOptions } from '@tanstack/react-query';

import { getGuardianConnections } from '@/service/api/guardian/connection';

export const guardianConnectionsQueryKey = ['guardian-connections'] as const;

export const guardianConnectionsQueryOptions = queryOptions({
  queryKey: guardianConnectionsQueryKey,
  queryFn: getGuardianConnections,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});
