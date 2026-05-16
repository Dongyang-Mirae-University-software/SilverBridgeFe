import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../interface/common';
import { IUserProfile } from '../interface/user';

export async function getMyProfile() {
  return apiClient.get<CommonResponse<IUserProfile>>('/api/auth/me');
}
