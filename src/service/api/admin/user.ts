import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '@/service/interface/common';
import {
  AdminUserCounts,
  AdminUserDetail,
  AdminUserListParams,
  AdminUserPage,
  AdminUserUpdateRequest,
} from '@/service/interface/admin/user';
import { getResponseData } from '@/utils/api/responseData';

const ADMIN_USER_BASE = '/admin/user';

export async function getAdminUsers(params: AdminUserListParams) {
  const response = await apiClient.get<CommonResponse<AdminUserPage>>(ADMIN_USER_BASE, { params });
  return getResponseData<AdminUserPage>(response);
}

export async function getAdminUserCounts() {
  const response = await apiClient.get<CommonResponse<AdminUserCounts>>(`${ADMIN_USER_BASE}/counts`);
  return getResponseData<AdminUserCounts>(response);
}

export async function getAdminUser(userId: string) {
  const response = await apiClient.get<CommonResponse<AdminUserDetail>>(`${ADMIN_USER_BASE}/${userId}`);
  return getResponseData<AdminUserDetail>(response);
}

export async function updateAdminUser(userId: string, body: AdminUserUpdateRequest) {
  await apiClient.patch<CommonResponse<void>>(`${ADMIN_USER_BASE}/${userId}`, body);
}

export async function deleteAdminUser(userId: string) {
  await apiClient.delete<CommonResponse<void>>(`${ADMIN_USER_BASE}/${userId}`);
}

export async function createAdminConnection(body: { guardianId: string; wardId: string }) {
  const response = await apiClient.post<CommonResponse<void>>('/admin/connection', body);
  return getResponseData<void>(response);
}

export async function deleteAdminConnection(connectionId: number) {
  await apiClient.delete<CommonResponse<void>>(`/admin/connection/${connectionId}`);
}
