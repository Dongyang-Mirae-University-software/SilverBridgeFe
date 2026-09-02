import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../../interface/common';
import { IFcmTokenReq } from '../../interface/notification';

const BASE = '/notifications';

export async function registerNotificationFcmToken(body: IFcmTokenReq) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/fcm-token`, body);
}

export async function deleteNotificationFcmToken(token: string) {
  return apiClient.delete<CommonResponse<null>>(`${BASE}/fcm-token`, {
    params: { token },
  });
}
