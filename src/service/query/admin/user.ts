import { queryOptions } from '@tanstack/react-query';

import { getAdminUser, getAdminUserCounts, getAdminUsers } from '@/service/api/admin/user';
import { AdminUserListParams } from '@/service/interface/admin/user';

export const adminUserQueryKey = ['admin-user'] as const;
export const adminUserCountsQueryKey = [...adminUserQueryKey, 'counts'] as const;

export const adminUserListQueryOptions = (params: AdminUserListParams) => queryOptions({
  queryKey: [...adminUserQueryKey, 'list', params] as const,
  queryFn: () => getAdminUsers(params),
  staleTime: 15_000,
});

export const adminUserDetailQueryOptions = (userId: string | null) => queryOptions({
  queryKey: [...adminUserQueryKey, 'detail', userId] as const,
  queryFn: () => getAdminUser(userId as string),
  enabled: !!userId,
});

export const adminUserCountsQueryOptions = queryOptions({
  queryKey: adminUserCountsQueryKey,
  queryFn: getAdminUserCounts,
  staleTime: 15_000,
});
