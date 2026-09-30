import { queryOptions } from '@tanstack/react-query';

import { getAvailableSlots, getHospitals, getMyReservations } from '@/service/api/guardian/reservation';

export const hospitalsQueryOptions = queryOptions({
  queryKey: ['reservation-hospitals'] as const,
  queryFn: getHospitals,
  staleTime: 60 * 1000,
  retry: false,
});

export const myReservationsQueryKey = ['reservation-my'] as const;

export const myReservationsQueryOptions = queryOptions({
  queryKey: myReservationsQueryKey,
  queryFn: getMyReservations,
  refetchOnMount: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

export function availableSlotsQueryOptions(hospitalId: number | null, date: string) {
  return queryOptions({
    queryKey: ['reservation-slots', hospitalId, date] as const,
    queryFn: () => getAvailableSlots(hospitalId as number, date),
    enabled: hospitalId !== null && Boolean(date),
    staleTime: 10 * 1000,
    retry: false,
  });
}
