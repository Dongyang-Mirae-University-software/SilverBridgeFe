import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../../interface/common';
import {
  IUserDeleteReq,
  IUserNotificationSettingsResponse,
  IUserNotificationSettingsUpdateReq,
  IUserPasswordChangeReq,
  IUserProfile,
  IUserUpdateReq,
} from '../../interface/user';

const BASE = '/user';

export async function getMyProfile() {
  return apiClient.get<CommonResponse<IUserProfile>>(`${BASE}/me`);
}

export async function updateMyProfile(body: IUserUpdateReq) {
  return apiClient.put<CommonResponse<IUserProfile>>(`${BASE}/me`, body);
}

export async function changeMyPassword(body: IUserPasswordChangeReq) {
  return apiClient.put<CommonResponse<null>>(`${BASE}/me/password`, body);
}

export async function changeMyProfileImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient.patch<CommonResponse<IUserProfile>>(`${BASE}/me/image`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export async function deleteMyProfileImage() {
  return apiClient.delete<CommonResponse<null>>(`${BASE}/me/image`);
}

export async function deleteMyAccount(body: IUserDeleteReq) {
  return apiClient.delete<CommonResponse<null>>(`${BASE}/me`, {
    data: body,
  });
}

export async function getMyNotificationSettings() {
  return apiClient.get<CommonResponse<IUserNotificationSettingsResponse>>(`${BASE}/me/notification-settings`);
}

export async function updateMyNotificationSettings(body: IUserNotificationSettingsUpdateReq) {
  return apiClient.put<CommonResponse<IUserNotificationSettingsResponse>>(`${BASE}/me/notification-settings`, body);
}
