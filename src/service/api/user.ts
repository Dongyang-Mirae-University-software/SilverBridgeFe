import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../interface/common';
import {
  IUserDeleteReq,
  IUserPasswordChangeReq,
  IUserProfile,
  IUserUpdateReq,
} from '../interface/user';

const BASE = '/api/user';

export async function getMyProfile() {
  return apiClient.get<CommonResponse<IUserProfile>>(`${BASE}/me/select`);
}

export async function updateMyProfile(body: IUserUpdateReq) {
  return apiClient.put<CommonResponse<IUserProfile>>(`${BASE}/me/update`, body);
}

export async function changeMyPassword(body: IUserPasswordChangeReq) {
  return apiClient.put<CommonResponse<null>>(`${BASE}/me/update/password-change`, body);
}

export async function changeMyProfileImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient.patch<CommonResponse<IUserProfile>>(`${BASE}/me/update/image-change`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export async function deleteMyAccount(body: IUserDeleteReq) {
  return apiClient.delete<CommonResponse<null>>(`${BASE}/me/delete`, {
    data: body,
  });
}
