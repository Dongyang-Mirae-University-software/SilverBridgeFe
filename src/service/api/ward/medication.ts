// 피보호자(WARD)의 복약 조회·체크 API
// Swagger 그룹: "피보호자 - 복약" (/api/ward/medication/**)
// 등록·수정·삭제는 이 그룹에 없다(보호자 전용 — service/api/guardian/medication.ts)

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { MedicationItem, TodayMedicationResponse } from '../../interface/medication';

const WARD_BASE = '/ward/medication';

// 오늘의 복약 일정. doseDate는 항상 KST 기준
export async function getTodayMedication() {
  const response = await apiClient.get<CommonResponse<TodayMedicationResponse>>(`${WARD_BASE}/today`);
  return getResponseData<TodayMedicationResponse>(response);
}

// 복용 체크 — 멱등(이미 체크된 약을 또 체크해도 에러 아님, 현재 상태 그대로 반환)
export async function checkMedicationIntake(medicationId: number) {
  const response = await apiClient.post<CommonResponse<MedicationItem>>(`${WARD_BASE}/${medicationId}/intake`);
  return getResponseData<MedicationItem>(response);
}

// 복용 체크 해제 — 마찬가지로 멱등
export async function uncheckMedicationIntake(medicationId: number) {
  const response = await apiClient.delete<CommonResponse<MedicationItem>>(`${WARD_BASE}/${medicationId}/intake`);
  return getResponseData<MedicationItem>(response);
}

// 같은 시간대 약 묶음 체크·해제(BE #369) - 전부 성공 또는 전부 실패, 약마다는 단건과 같은 멱등
// 응답은 요청 순서대로 갱신된 항목 목록
export async function setMedicationIntakeBatch(medicationIds: number[], taken: boolean) {
  const response = await apiClient.post<CommonResponse<MedicationItem[]>>(`${WARD_BASE}/intake/batch`, {
    medicationIds,
    taken,
  });
  return getResponseData<MedicationItem[]>(response);
}
