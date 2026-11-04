import { queryOptions } from '@tanstack/react-query';

import { getAdminChatStats, getAdminCompanionStats } from '@/service/api/admin/aiStats';
import { AdminChatStatsParams } from '@/service/interface/admin/aiStats';

export const adminAiStatsQueryKey = ['admin-ai-stats'] as const;

export const adminChatStatsQueryOptions = (params: AdminChatStatsParams) => queryOptions({
  queryKey: [...adminAiStatsQueryKey, 'chat', params] as const,
  queryFn: () => getAdminChatStats(params),
  staleTime: 60_000,
  refetchOnWindowFocus: false,
  retry: false,
});

// 화면에 들어올 때만 부른다(자동 반복 호출 금지). 탭을 오가거나 창으로 돌아와도 1분 안에는 다시 부르지 않는다
export const adminCompanionStatsQueryOptions = queryOptions({
  queryKey: [...adminAiStatsQueryKey, 'companion'] as const,
  queryFn: getAdminCompanionStats,
  staleTime: 60_000,
  refetchOnWindowFocus: false,
  retry: false,
});
