import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '@/service/interface/common';
import { AdminAnomalyPage, AdminAnomalyParams, AdminAnomalySummary, AdminAnomalySummaryParams } from '@/service/interface/admin/anomaly';
import { getResponseData } from '@/utils/api/responseData';

export async function getAdminAnomalies(params: AdminAnomalyParams) { const response = await apiClient.get<CommonResponse<AdminAnomalyPage>>('/admin/anomaly', { params }); return getResponseData<AdminAnomalyPage>(response); }
export async function getAdminAnomalySummary(params: AdminAnomalySummaryParams) { const response = await apiClient.get<CommonResponse<AdminAnomalySummary>>('/admin/anomaly/summary', { params }); return getResponseData<AdminAnomalySummary>(response); }
