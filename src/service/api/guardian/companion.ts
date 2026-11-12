// 보호자(GUARDIAN)의 피보호자 오늘 안부 대화·기분 조회 API
// Swagger 그룹: "보호자 - AI 기분 체크" (/api/guardian/ward/{wardId}/companion/today)
// ACTIVE 연결된 피보호자만, 지금 연결이 맺어진 뒤의 대화만 보인다. 아니면 403 COMPANION_NOT_AUTHORIZED

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { ICompanionSessionDetail, ICompanionToday, ICompanionWeek } from '../../interface/guardian/companion';

export async function getWardCompanionToday(wardId: string) {
  const response = await apiClient.get<CommonResponse<ICompanionToday>>(
    `/guardian/ward/${encodeURIComponent(wardId)}/companion/today`,
  );
  return getResponseData<ICompanionToday>(response);
}

// 최근 7일 하루 기분
export async function getWardCompanionWeek(wardId: string) {
  const response = await apiClient.get<CommonResponse<ICompanionWeek>>(
    `/guardian/ward/${encodeURIComponent(wardId)}/companion/week`,
  );
  return getResponseData<ICompanionWeek>(response);
}

// 고른 날(최근 7일 안)의 시간대 목록 - today와 같은 모양. 범위 밖이면 400 COMPANION_DATE_OUT_OF_RANGE
export async function getWardCompanionDay(wardId: string, date: string) {
  const response = await apiClient.get<CommonResponse<ICompanionToday>>(
    `/guardian/ward/${encodeURIComponent(wardId)}/companion/days/${encodeURIComponent(date)}`,
  );
  return getResponseData<ICompanionToday>(response);
}

// 대화 보기 - 기분은 항상, 글은 transcript=AVAILABLE일 때만
export async function getWardCompanionSession(wardId: string, sessionId: number) {
  const response = await apiClient.get<CommonResponse<ICompanionSessionDetail>>(
    `/guardian/ward/${encodeURIComponent(wardId)}/companion/sessions/${sessionId}`,
  );
  return getResponseData<ICompanionSessionDetail>(response);
}
