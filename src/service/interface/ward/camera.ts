// 피보호자(WARD)의 이상감지 카메라 등록 타입
// Swagger 그룹: "피보호자 - 카메라" (/api/ward/camera/**)

export interface WardCamera {
  id: number;
  sessionId: string;
  deviceId: string;
  label: string;
  isActive: boolean;
  recommendedFps: number;
  createdAt: string;
}

export interface RegisterWardCameraReq {
  label: string;
  deviceId?: string;
}

export interface UpdateWardCameraReq {
  label?: string;
  isActive?: boolean;
}
