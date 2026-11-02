import { queryOptions } from '@tanstack/react-query';

import { getAdminChatStats } from '@/service/api/admin/aiStats';
import { AdminChatStatsParams } from '@/service/interface/admin/aiStats';

export const adminAiStatsQueryKey = ['admin-ai-stats'] as const;

export const adminChatStatsQueryOptions = (params: AdminChatStatsParams) => queryOptions({
  queryKey: [...adminAiStatsQueryKey, 'chat', params] as const,
  queryFn: () => getAdminChatStats(params),
  staleTime: 60_000,
  refetchOnWindowFocus: false,
  retry: false,
});
