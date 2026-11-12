import { queryOptions } from '@tanstack/react-query';

import {
  getWardCompanionDay,
  getWardCompanionSession,
  getWardCompanionToday,
  getWardCompanionWeek,
} from '@/service/api/guardian/companion';

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

// 기분·대화 내용이라 today와 같이 들어올 때마다 새로 받는다
const FRESH = { refetchOnMount: 'always', refetchOnWindowFocus: 'always', staleTime: 10 * 1000, retry: false } as const;

export function wardCompanionWeekQueryOptions(wardId: string) {
  return queryOptions({
    queryKey: [...wardCompanionTodayQueryKey, wardId, 'week'] as const,
    queryFn: () => getWardCompanionWeek(wardId),
    ...FRESH,
  });
}

export function wardCompanionDayQueryOptions(wardId: string, date: string) {
  return queryOptions({
    queryKey: [...wardCompanionTodayQueryKey, wardId, 'day', date] as const,
    queryFn: () => getWardCompanionDay(wardId, date),
    ...FRESH,
  });
}

export function wardCompanionSessionQueryOptions(wardId: string, sessionId: number) {
  return queryOptions({
    queryKey: [...wardCompanionTodayQueryKey, wardId, 'session', sessionId] as const,
    queryFn: () => getWardCompanionSession(wardId, sessionId),
    ...FRESH,
  });
}
