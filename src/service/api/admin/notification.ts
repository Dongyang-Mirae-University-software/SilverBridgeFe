import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '@/service/interface/common';
import {
  AdminNotificationListParams,
  AdminNotificationPage,
  AdminNotificationSummary,
  AdminNotificationSummaryParams,
} from '@/service/interface/admin/notification';
import { getResponseData } from '@/utils/api/responseData';

const ADMIN_NOTIFICATION_BASE = '/admin/notification';

export async function getAdminNotificationLogs(params: AdminNotificationListParams) {
  const response = await apiClient.get<CommonResponse<AdminNotificationPage>>(ADMIN_NOTIFICATION_BASE, { params });
  return getResponseData<AdminNotificationPage>(response);
}

// 요약은 결과(result)별 카드 숫자를 직접 주므로 result를 보내지 않는다.
export async function getAdminNotificationSummary(params: AdminNotificationSummaryParams) {
  const response = await apiClient.get<CommonResponse<AdminNotificationSummary>>(`${ADMIN_NOTIFICATION_BASE}/summary`, { params });
  return getResponseData<AdminNotificationSummary>(response);
}
