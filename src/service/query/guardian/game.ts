import { queryOptions } from '@tanstack/react-query';

import { getWardGameActivity, getWardGameSummary } from '@/service/api/guardian/game';

export const wardGameSummaryQueryKey = ['guardian-ward-game'] as const;

export function wardGameSummaryQueryOptions(wardId: string) {
  return queryOptions({
    queryKey: [...wardGameSummaryQueryKey, wardId] as const,
    queryFn: () => getWardGameSummary(wardId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    staleTime: 10 * 1000,
    retry: false,
  });
}

export function wardGameActivityQueryOptions(wardId: string) {
  return queryOptions({
    queryKey: [...wardGameSummaryQueryKey, 'activity', wardId] as const,
    queryFn: () => getWardGameActivity(wardId),
    staleTime: 60 * 1000,
    retry: false,
  });
}
