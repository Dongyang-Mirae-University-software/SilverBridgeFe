import { queryOptions } from '@tanstack/react-query';

import { getMyProfile } from '@/service/api/user';

export const myProfileQueryKey = ['my-profile'] as const;

export const myProfileQueryOptions = queryOptions({
  queryKey: myProfileQueryKey,
  queryFn: getMyProfile,
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: false,
});
