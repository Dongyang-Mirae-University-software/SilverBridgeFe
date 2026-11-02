import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '@/service/interface/common';
import { AdminAiServiceStatus, AdminOperationDashboard, AdminSafetyDashboard } from '@/service/interface/admin/dashboard';

export async function getAdminSafetyDashboard() {
  const response = await apiClient.get<CommonResponse<AdminSafetyDashboard>>('/admin/dashboard/safety');
  return getResponseData<AdminSafetyDashboard>(response);
}

export async function getAdminOperationDashboard() {
  const response = await apiClient.get<CommonResponse<AdminOperationDashboard>>('/admin/dashboard/operation');
  return getResponseData<AdminOperationDashboard>(response);
}

export async function getAdminAiServiceStatus() {
  const response = await apiClient.get<CommonResponse<AdminAiServiceStatus>>('/admin/dashboard/ai-status');
  return getResponseData<AdminAiServiceStatus>(response);
}
