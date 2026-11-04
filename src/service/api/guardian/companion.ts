// 보호자(GUARDIAN)의 피보호자 오늘 안부 대화·기분 조회 API
// Swagger 그룹: "보호자 - AI 기분 체크" (/api/guardian/ward/{wardId}/companion/today)
// ACTIVE 연결된 피보호자만, 지금 연결이 맺어진 뒤의 대화만 보인다. 아니면 403 COMPANION_NOT_AUTHORIZED

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { ICompanionToday } from '../../interface/guardian/companion';

export async function getWardCompanionToday(wardId: string) {
  const response = await apiClient.get<CommonResponse<ICompanionToday>>(
    `/guardian/ward/${encodeURIComponent(wardId)}/companion/today`,
  );
  return getResponseData<ICompanionToday>(response);
}
