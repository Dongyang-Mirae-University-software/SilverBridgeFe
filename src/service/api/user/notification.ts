// 알림 설정(채널 ON/OFF) + FCM 푸시 토큰 등록·삭제 API
// Swagger 그룹: "공통 - 알림 설정" (/api/user/me/notification-settings, /api/notifications/fcm-token)
// SOS 등 필수 알림은 이 설정과 무관하게 항상 발송됨

import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../../interface/common';
import { IFcmTokenReq } from '../../interface/user/notification';
import { IUserNotificationSettingsResponse, IUserNotificationSettingsUpdateReq } from '../../interface/user/user';

const USER_BASE = '/user';
const NOTIFICATIONS_BASE = '/notifications';

// 알림 채널(FCM/SMS/카카오 알림톡/이메일) ON/OFF 설정 조회
export async function getMyNotificationSettings() {
  return apiClient.get<CommonResponse<IUserNotificationSettingsResponse>>(`${USER_BASE}/me/notification-settings`);
}

// 알림 채널 설정 변경
export async function updateMyNotificationSettings(body: IUserNotificationSettingsUpdateReq) {
  return apiClient.put<CommonResponse<IUserNotificationSettingsResponse>>(
    `${USER_BASE}/me/notification-settings`,
    body,
  );
}

// FCM 토큰 등록 (로그인 직후·앱 시작·토큰 갱신 시). 기기 단위로 관리됨
export async function registerNotificationFcmToken(body: IFcmTokenReq) {
  return apiClient.post<CommonResponse<null>>(`${NOTIFICATIONS_BASE}/fcm-token`, body);
}

// FCM 토큰 삭제 (로그아웃 시)
export async function deleteNotificationFcmToken(token: string) {
  return apiClient.delete<CommonResponse<null>>(`${NOTIFICATIONS_BASE}/fcm-token`, {
    params: { token },
  });
}
