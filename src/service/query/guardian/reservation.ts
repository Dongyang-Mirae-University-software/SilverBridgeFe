import { queryOptions } from '@tanstack/react-query';

import { getAvailableSlots, getHospitals, getMyReservations } from '@/service/api/guardian/reservation';

export const hospitalsQueryOptions = queryOptions({
  queryKey: ['reservation-hospitals'] as const,
  queryFn: getHospitals,
  staleTime: 60 * 1000,
  retry: false,
});

export const myReservationsQueryKey = ['reservation-my'] as const;

// wardId 없이 호출하면 로그인한 피보호자 본인의 예약 내역
export function myReservationsQueryOptions(wardId?: string | null) {
  return queryOptions({
    queryKey: [...myReservationsQueryKey, wardId ?? null] as const,
    queryFn: () => getMyReservations(wardId),
    refetchOnMount: 'always',
    staleTime: 10 * 1000,
    retry: false,
  });
}

export function availableSlotsQueryOptions(hospitalId: number | null, date: string) {
  return queryOptions({
    queryKey: ['reservation-slots', hospitalId, date] as const,
    queryFn: () => getAvailableSlots(hospitalId as number, date),
    enabled: hospitalId !== null && Boolean(date),
    staleTime: 10 * 1000,
    retry: false,
  });
}
