// 보호자(GUARDIAN)가 볼 수 있는 카메라 허용 목록 타입
// Swagger 그룹: "보호자 - 카메라" (/api/guardian/camera)
// deviceId는 보호자에게 내려주지 않는다(민감 값이라 필요 없음)

export interface GuardianCameraAllowlistItem {
  sessionId: string;
  wardId: string;
  wardName: string;
  label: string;
  isActive: boolean;
}
