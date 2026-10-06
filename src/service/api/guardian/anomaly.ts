// 보호자(GUARDIAN)의 이상감지 이력 조회·오탐 응답·재촉 알림 설정 API
// Swagger 그룹: "보호자 - 이상감지" (/api/guardian/anomaly/**)

import { apiClient } from '@/lib/api/apiClient';
import { getAccessToken } from '@/lib/auth/tokenStore';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import {
  AnomalyClip,
  AnomalyClipFileError,
  AnomalyFeedbackReq,
  AnomalyFeedbackRes,
  AnomalyHistoryPage,
  AnomalyReminderSetting,
  GetAnomalyHistoryParams,
  UpdateAnomalyReminderSettingReq,
} from '../../interface/guardian/anomaly';

const GUARDIAN_ANOMALY_BASE = '/guardian/anomaly';

// wardId 생략 시 ACTIVE 연결된 피보호자 전원의 이력을 합쳐서 최신순 반환
export async function getGuardianAnomalyHistory(params: GetAnomalyHistoryParams = {}) {
  const response = await apiClient.get<CommonResponse<AnomalyHistoryPage>>(`${GUARDIAN_ANOMALY_BASE}/history`, {
    params,
  });
  return getResponseData<AnomalyHistoryPage>(response);
}

// 실제 위험(REAL)/오탐(FALSE_ALARM) 응답. 1인 1표, 다시 호출하면 이전 응답을 덮어씀
export async function submitAnomalyFeedback(incidentId: number, body: AnomalyFeedbackReq) {
  const response = await apiClient.post<CommonResponse<AnomalyFeedbackRes>>(
    `${GUARDIAN_ANOMALY_BASE}/${incidentId}/feedback`,
    body,
  );
  return getResponseData<AnomalyFeedbackRes>(response);
}

// 미응답 건 확인 요청 알림 수신 여부. 설정한 적 없으면 기본값 true
export async function getAnomalyReminderSetting() {
  const response = await apiClient.get<CommonResponse<AnomalyReminderSetting>>(
    `${GUARDIAN_ANOMALY_BASE}/reminder-setting`,
  );
  return getResponseData<AnomalyReminderSetting>(response);
}

export async function updateAnomalyReminderSetting(body: UpdateAnomalyReminderSettingReq) {
  const response = await apiClient.put<CommonResponse<AnomalyReminderSetting>>(
    `${GUARDIAN_ANOMALY_BASE}/reminder-setting`,
    body,
  );
  return getResponseData<AnomalyReminderSetting>(response);
}

// 상황(incident)의 클립 목록, 최신순, 없으면 []
export async function getGuardianAnomalyClips(incidentId: number) {
  const response = await apiClient.get<CommonResponse<AnomalyClip[]>>(`${GUARDIAN_ANOMALY_BASE}/${incidentId}/clips`);
  return getResponseData<AnomalyClip[]>(response) ?? [];
}

// 클립 파일은 Authorization 헤더가 필요해서 <video src>에 직접 넣을 수 없음 —
// fetch로 받아 blob으로 재생해야 함. 에러 응답은 파일 API도 JSON(ApiResponse)이라
// 여기서 분기용으로 status/code/message를 추출해서 throw
export async function fetchGuardianAnomalyClipFile(clipId: number): Promise<Blob> {
  const token = getAccessToken();
  const response = await fetch(`/api${GUARDIAN_ANOMALY_BASE}/clips/${clipId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
    const error: AnomalyClipFileError = { status: response.status, code: body?.code, message: body?.message };
    throw error;
  }

  return response.blob();
}
