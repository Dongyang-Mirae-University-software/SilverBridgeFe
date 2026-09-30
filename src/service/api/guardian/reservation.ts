// 보호자(GUARDIAN)의 병원 예약 API — 예약 서비스로 가는 BFF(/api/reservation/**)를 호출
import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { IAvailableSlots, IHospital, IReservationCreateReq, IReservationItem } from '../../interface/reservation';

const BASE = '/reservation';

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

export async function getMyReservations() {
  const response = await apiClient.get<CommonResponse<IReservationItem[]>>(`${BASE}/reservations/my`);
  return getResponseData<IReservationItem[]>(response) ?? [];
}

export async function createReservation(body: IReservationCreateReq) {
  return apiClient.post<CommonResponse<{ reservationId: number; message: string }>>(`${BASE}/reservations`, body);
}

export async function cancelReservation(reservationId: number) {
  return apiClient.patch<CommonResponse<{ reservationId: number }>>(`${BASE}/reservations/${reservationId}/cancel`);
}
