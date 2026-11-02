import { queryOptions } from '@tanstack/react-query';

import { getAdminNotificationLogs, getAdminNotificationSummary } from '@/service/api/admin/notification';
import { AdminNotificationListParams, AdminNotificationSummaryParams } from '@/service/interface/admin/notification';

export const adminNotificationQueryKey = ['admin-notification'] as const;

export const adminNotificationListQueryOptions = (params: AdminNotificationListParams) => queryOptions({
  queryKey: [...adminNotificationQueryKey, 'list', params] as const,
  queryFn: () => getAdminNotificationLogs(params),
  staleTime: 15_000,
});

export const adminNotificationSummaryQueryOptions = (params: AdminNotificationSummaryParams) => queryOptions({
  queryKey: [...adminNotificationQueryKey, 'summary', params] as const,
  queryFn: () => getAdminNotificationSummary(params),
  staleTime: 15_000,
});
