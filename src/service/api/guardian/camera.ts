// 보호자(GUARDIAN)의 카메라 허용 목록 조회 API
// Swagger 그룹: "보호자 - 카메라" (/api/guardian/camera)
// 연결된(ACTIVE) 피보호자들의 카메라만 내려온다. AI 서버의 전체 세션 목록은 이 허용
// 목록과 겹치는 것만 화면에 보여줘야 한다 — 초기 조회와 WebSocket 수신 양쪽 다 필터 필요

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { GuardianCameraAllowlistItem } from '../../interface/guardian/camera';

const GUARDIAN_CAMERA_BASE = '/guardian/camera';

export async function getGuardianCameras() {
  const response = await apiClient.get<CommonResponse<GuardianCameraAllowlistItem[]>>(GUARDIAN_CAMERA_BASE);
  return getResponseData<GuardianCameraAllowlistItem[]>(response) ?? [];
}
