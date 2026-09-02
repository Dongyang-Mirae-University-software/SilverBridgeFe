import { queryOptions } from '@tanstack/react-query';

import { getWardConnections } from '@/service/api/ward/connection';

export const wardConnectionsQueryKey = ['ward-connections'] as const;

export const wardConnectionsQueryOptions = queryOptions({
  queryKey: wardConnectionsQueryKey,
  queryFn: getWardConnections,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});
