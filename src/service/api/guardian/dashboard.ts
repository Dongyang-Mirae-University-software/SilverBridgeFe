// 보호자(GUARDIAN) 대시보드 요약 API
// Swagger 그룹: "보호자 - 대시보드" (/api/guardian/dashboard)

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { GetGuardianDashboardParams, GuardianDashboardResponse } from '../../interface/guardian/dashboard';

// wardId 생략 시 ACTIVE 연결된 피보호자 전원을 합산. 지정 시 ACTIVE 연결이 아니면 403
export async function getGuardianDashboard(params: GetGuardianDashboardParams = {}) {
  const response = await apiClient.get<CommonResponse<GuardianDashboardResponse>>('/guardian/dashboard', { params });
  return getResponseData<GuardianDashboardResponse>(response);
}
