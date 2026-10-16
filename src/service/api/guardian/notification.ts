// 보호자(GUARDIAN)의 알림 종류 설정 API
// Swagger 그룹: "보호자 - 알림 종류 설정" (/api/guardian/notification-type-setting)

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import {
  GuardianNotificationTypeSetting,
  UpdateGuardianNotificationTypeSettingReq,
} from '../../interface/guardian/notification';

const GUARDIAN_NOTIFICATION_TYPE_SETTING_PATH = '/guardian/notification-type-setting';

// 설정한 적 없는 보호자도 기본값(전부 켜짐)으로 내려온다
export async function getGuardianNotificationTypeSetting() {
  const response = await apiClient.get<CommonResponse<GuardianNotificationTypeSetting>>(
    GUARDIAN_NOTIFICATION_TYPE_SETTING_PATH,
  );
  return getResponseData<GuardianNotificationTypeSetting>(response);
}

// anomalyReviewReminder·medication·cameraLinkLost만 변경 가능 — sos·anomalyDetection을 보내도 무시됨(저장 안 됨, 에러도 아님)
export async function updateGuardianNotificationTypeSetting(body: UpdateGuardianNotificationTypeSettingReq) {
  const response = await apiClient.put<CommonResponse<GuardianNotificationTypeSetting>>(
    GUARDIAN_NOTIFICATION_TYPE_SETTING_PATH,
    body,
  );
  return getResponseData<GuardianNotificationTypeSetting>(response);
}
