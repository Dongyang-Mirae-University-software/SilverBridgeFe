// 보호자(GUARDIAN)의 복약 관리 API
// Swagger 그룹: "보호자 - 복약" (/api/guardian/medication/**, /api/guardian/ward/{wardId}/medication*)
// 등록·수정·삭제는 보호자 전용이며, 복용 체크는 이 그룹에 없다(체크는 피보호자 전용 — service/api/ward/medication.ts)

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import {
  AddMedicationReq,
  GuardianMedicationAlertSetting,
  MedicationItem,
  MedicationSettingResponse,
  UpdateMedicationAlertSettingReq,
  UpdateMedicationReq,
  UpdateMedicationSettingReq,
  WardMedicationSummary,
} from '../../interface/medication';

const GUARDIAN_BASE = '/guardian';

// 연결된(ACTIVE) 피보호자 전원의 오늘 복약 현황 카드 목록. 파라미터 없음
export async function getGuardianMedications() {
  const response = await apiClient.get<CommonResponse<WardMedicationSummary[]>>(`${GUARDIAN_BASE}/medication`);
  return getResponseData<WardMedicationSummary[]>(response) ?? [];
}

// 약 추가. doseTime 생략 시 슬롯 기본 시각, doseAmount 생략 시 1
export async function addWardMedication(wardId: string, body: AddMedicationReq) {
  const response = await apiClient.post<CommonResponse<MedicationItem>>(
    `${GUARDIAN_BASE}/ward/${wardId}/medication`,
    body,
  );
  return getResponseData<MedicationItem>(response);
}

// 약 수정(부분 수정). timeSlot만 보내면 doseTime이 그 슬롯 기본 시각으로 갱신되므로,
// 기존 시각을 유지하려면 doseTime을 함께 보내야 한다. 메모를 지우려면 ''(빈 문자열)를 보낸다
export async function updateGuardianMedication(medicationId: number, body: UpdateMedicationReq) {
  const response = await apiClient.patch<CommonResponse<MedicationItem>>(
    `${GUARDIAN_BASE}/medication/${medicationId}`,
    body,
  );
  return getResponseData<MedicationItem>(response);
}

// 약 삭제(soft delete) — 지난 복용 이력은 남고 이후 조회에만 안 나옴
export async function deleteGuardianMedication(medicationId: number) {
  return apiClient.delete<CommonResponse<null>>(`${GUARDIAN_BASE}/medication/${medicationId}`);
}

// 그 피보호자에게 보낼 알림 설정(복용 알림/재알림 ON-OFF) — 보호자들이 공유하는 값
export async function getMedicationSetting(wardId: string) {
  const response = await apiClient.get<CommonResponse<MedicationSettingResponse>>(
    `${GUARDIAN_BASE}/ward/${wardId}/medication-setting`,
  );
  return getResponseData<MedicationSettingResponse>(response);
}

export async function updateMedicationSetting(wardId: string, body: UpdateMedicationSettingReq) {
  const response = await apiClient.put<CommonResponse<MedicationSettingResponse>>(
    `${GUARDIAN_BASE}/ward/${wardId}/medication-setting`,
    body,
  );
  return getResponseData<MedicationSettingResponse>(response);
}

// 내가 그 피보호자 건 미복용 요약을 받을지 + 받을 시각 — 나(보호자)만의 값
export async function getMedicationAlertSetting(wardId: string) {
  const response = await apiClient.get<CommonResponse<GuardianMedicationAlertSetting>>(
    `${GUARDIAN_BASE}/ward/${wardId}/medication-alert-setting`,
  );
  return getResponseData<GuardianMedicationAlertSetting>(response);
}

export async function updateMedicationAlertSetting(wardId: string, body: UpdateMedicationAlertSettingReq) {
  const response = await apiClient.put<CommonResponse<GuardianMedicationAlertSetting>>(
    `${GUARDIAN_BASE}/ward/${wardId}/medication-alert-setting`,
    body,
  );
  return getResponseData<GuardianMedicationAlertSetting>(response);
}
