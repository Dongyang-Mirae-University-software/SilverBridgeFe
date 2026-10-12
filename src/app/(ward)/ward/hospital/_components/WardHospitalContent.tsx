'use client';

import { useQuery } from '@tanstack/react-query';

import { ReservationList } from '@/components/reservation/ReservationList';
import { myReservationsQueryOptions } from '@/service/query/guardian/reservation';

// 보호자가 피보호자 계정으로 잡은 예약이라 본인 계정 조회(wardId 없음)로 그대로 보인다.
export function WardHospitalContent() {
  const { data: reservations = [], isLoading } = useQuery(myReservationsQueryOptions());
  return <ReservationList reservations={reservations} isLoading={isLoading} />;
}
