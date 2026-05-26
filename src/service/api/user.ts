import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../interface/common';
import {
  IUserDeleteReq,
  IUserPasswordChangeReq,
  IUserProfile,
  IUserUpdateReq,
} from '../interface/user';

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
  return apiClient.patch<CommonResponse<IUserProfile>>(`${BASE}/me/image`);
}

export async function deleteMyAccount(body: IUserDeleteReq) {
  return apiClient.delete<CommonResponse<null>>(`${BASE}/me`, {
    data: body,
  });
}
