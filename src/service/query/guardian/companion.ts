import { queryOptions } from '@tanstack/react-query';

import { getWardCompanionToday } from '@/service/api/guardian/companion';

export const wardCompanionTodayQueryKey = ['guardian-companion-today'] as const;

// 기분 정보라 서버도 캐시하지 않는다(no-store). 화면에 들어올 때·창으로 돌아올 때마다 새로 받는다
export function wardCompanionTodayQueryOptions(wardId: string) {
  return queryOptions({
    queryKey: [...wardCompanionTodayQueryKey, wardId] as const,
    queryFn: () => getWardCompanionToday(wardId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    staleTime: 10 * 1000,
    retry: false,
  });
}
