import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '@/service/interface/common';
import { AdminChatStats, AdminChatStatsParams, AdminCompanionStats } from '@/service/interface/admin/aiStats';

export async function getAdminChatStats(params: AdminChatStatsParams) {
  const response = await apiClient.get<CommonResponse<AdminChatStats>>('/admin/ai-stats/chat', { params });
  return getResponseData<AdminChatStats>(response);
}

// 안부 말벗 오늘 집계 - AI 통계 탭과 대시보드 카드가 같이 쓴다. 파라미터 없음
export async function getAdminCompanionStats() {
  const response = await apiClient.get<CommonResponse<AdminCompanionStats>>('/admin/ai-stats/companion');
  return getResponseData<AdminCompanionStats>(response);
}
