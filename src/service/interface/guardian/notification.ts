// 보호자(GUARDIAN)의 "알림 종류"(어떤 상황에 알림을 받을지) 설정 타입
// Swagger 그룹: "보호자 - 알림 종류 설정" (/api/guardian/notification-type-setting)
// sos·anomalyDetection은 required:true로 내려오며 끌 수 없다(요청해도 무시됨)

export interface GuardianNotificationTypeItem {
  enabled: boolean;
  required: boolean;
}

export interface GuardianNotificationTypeSetting {
  sos: GuardianNotificationTypeItem;
  anomalyDetection: GuardianNotificationTypeItem;
  anomalyReviewReminder: GuardianNotificationTypeItem;
  medication: GuardianNotificationTypeItem;
  // 카메라 연결 끊김 안내(BE V61). 옛 서버 응답에는 없을 수 있어 선택값으로 둔다 - 없으면 켜진 것으로 본다
  cameraLinkLost?: GuardianNotificationTypeItem;
}

export interface UpdateGuardianNotificationTypeSettingReq {
  anomalyReviewReminder?: boolean;
  medication?: boolean;
  cameraLinkLost?: boolean;
}
