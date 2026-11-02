import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '@/service/interface/common';
import { AdminChatStats, AdminChatStatsParams } from '@/service/interface/admin/aiStats';

export async function getAdminChatStats(params: AdminChatStatsParams) {
  const response = await apiClient.get<CommonResponse<AdminChatStats>>('/admin/ai-stats/chat', { params });
  return getResponseData<AdminChatStats>(response);
}
