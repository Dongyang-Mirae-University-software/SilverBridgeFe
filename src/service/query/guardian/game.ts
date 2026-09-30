import { queryOptions } from '@tanstack/react-query';

import { getWardGameActivity, getWardGameSummary } from '@/service/api/guardian/game';

export const wardGameSummaryQueryKey = ['guardian-ward-game'] as const;

export function wardGameSummaryQueryOptions(gameUserId: number) {
  return queryOptions({
    queryKey: [...wardGameSummaryQueryKey, gameUserId] as const,
    queryFn: () => getWardGameSummary(gameUserId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    staleTime: 10 * 1000,
    retry: false,
  });
}

export function wardGameActivityQueryOptions(gameUserId: number) {
  return queryOptions({
    queryKey: [...wardGameSummaryQueryKey, 'activity', gameUserId] as const,
    queryFn: () => getWardGameActivity(gameUserId),
    staleTime: 60 * 1000,
    retry: false,
  });
}
