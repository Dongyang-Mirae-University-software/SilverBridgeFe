import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { INotificationInboxPage, NotificationInboxCategory } from '../../interface/user/notificationInbox';

const BASE = '/user/me/notifications';

// 최신순. size 기본 20·최대 50, category 생략 = 전체
export async function getMyNotifications(params: { category?: NotificationInboxCategory; page: number; size: number }) {
  const response = await apiClient.get<CommonResponse<INotificationInboxPage>>(BASE, { params });
  return getResponseData<INotificationInboxPage>(response);
}

export async function getMyUnreadNotificationCount() {
  const response = await apiClient.get<CommonResponse<{ count: number }>>(`${BASE}/unread-count`);
  return getResponseData<{ count: number }>(response)?.count ?? 0;
}

// 이미 읽은 알림이어도 200 - 중복 호출해도 된다
export async function readMyNotification(id: number) {
  await apiClient.post(`${BASE}/${id}/read`);
}

export async function readAllMyNotifications() {
  const response = await apiClient.post<CommonResponse<{ updated: number }>>(`${BASE}/read-all`);
  return getResponseData<{ updated: number }>(response)?.updated ?? 0;
}
