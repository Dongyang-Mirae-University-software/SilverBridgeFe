// 병원 예약 API — 예약 서비스로 가는 BFF(/api/reservation/**)를 호출.
// 예약은 피보호자 계정 소유라 보호자는 wardId(x-sb-ward-id 헤더)로 대신 호출하고, 피보호자 웹은 wardId 없이 호출한다.
import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { IAvailableSlots, IHospital, IReservationCreateReq, IReservationItem } from '../../interface/reservation';

const BASE = '/reservation';

const asWard = (wardId?: string | null) => (wardId ? { headers: { 'x-sb-ward-id': wardId } } : undefined);

export async function getHospitals() {
  const response = await apiClient.get<CommonResponse<IHospital[]>>(`${BASE}/hospitals`);
  return getResponseData<IHospital[]>(response) ?? [];
}

export async function getAvailableSlots(hospitalId: number, date: string) {
  const response = await apiClient.get<CommonResponse<IAvailableSlots>>(
    `${BASE}/hospitals/${hospitalId}/available-slots`,
    { params: { date } },
  );
  return getResponseData<IAvailableSlots>(response)?.availableSlots ?? [];
}

export async function getMyReservations(wardId?: string | null) {
  const response = await apiClient.get<CommonResponse<IReservationItem[]>>(`${BASE}/reservations/my`, asWard(wardId));
  return getResponseData<IReservationItem[]>(response) ?? [];
}

export async function createReservation(wardId: string, body: IReservationCreateReq) {
  return apiClient.post<CommonResponse<{ reservationId: number; message: string }>>(
    `${BASE}/reservations`,
    body,
    asWard(wardId),
  );
}

export async function cancelReservation(wardId: string, reservationId: number) {
  return apiClient.patch<CommonResponse<{ reservationId: number }>>(
    `${BASE}/reservations/${reservationId}/cancel`,
    undefined,
    asWard(wardId),
  );
}
