import { queryOptions } from '@tanstack/react-query';

import { getWardCompanionToday, getWardCompanionTranscriptConsent } from '@/service/api/ward/companion';

export const wardCompanionTodayQueryKey = ['ward-companion-today'] as const;

// 시간대가 바뀌면 시작 버튼이 열리고 닫혀야 해서 화면에 돌아올 때마다 다시 받는다
export const wardCompanionTodayQueryOptions = queryOptions({
  queryKey: wardCompanionTodayQueryKey,
  queryFn: getWardCompanionToday,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

export const wardCompanionConsentQueryKey = ['ward-companion-transcript-consent'] as const;

export const wardCompanionConsentQueryOptions = queryOptions({
  queryKey: wardCompanionConsentQueryKey,
  queryFn: getWardCompanionTranscriptConsent,
  staleTime: 60 * 1000,
  retry: false,
});
