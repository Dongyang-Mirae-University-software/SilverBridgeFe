// 보호자(GUARDIAN)의 카메라 실시간 시청 API — 전부 백엔드 중계
// Swagger 그룹: "보호자 - 카메라" (/api/guardian/camera)

import { apiClient } from '@/lib/api/apiClient';
import { getAccessToken } from '@/lib/auth/tokenStore';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import {
  GuardianCameraAllowlistItem,
  GuardianCameraFileError,
  GuardianCameraStatus,
  GuardianCameraStreamTicket,
  GuardianLiveCamera,
} from '../../interface/guardian/camera';

const GUARDIAN_CAMERA_BASE = '/guardian/camera';

/** @deprecated 백엔드 중계(`/live`)로 대체됨 — useGuardianMonitor 재작성 후 삭제 예정 */
export async function getGuardianCameras() {
  const response = await apiClient.get<CommonResponse<GuardianCameraAllowlistItem[]>>(GUARDIAN_CAMERA_BASE);
  return getResponseData<GuardianCameraAllowlistItem[]>(response) ?? [];
}

// 연결된(ACTIVE) 피보호자의 카메라만 백엔드가 이미 걸러서 내려준다 — 프론트에서 추가 필터 불필요
export async function getGuardianLiveCameras() {
  const response = await apiClient.get<CommonResponse<GuardianLiveCamera[]>>(`${GUARDIAN_CAMERA_BASE}/live`);
  return getResponseData<GuardianLiveCamera[]>(response) ?? [];
}

export async function getGuardianCameraStatus(sessionId: string) {
  const response = await apiClient.get<CommonResponse<GuardianCameraStatus>>(
    `${GUARDIAN_CAMERA_BASE}/${sessionId}/status`,
  );
  return getResponseData<GuardianCameraStatus>(response);
}

// 60초 안에 1번만 쓸 수 있는 영상 입장권. 카메라를 바꾸거나 다시 열 때마다 새로 받아야 한다
export async function issueGuardianCameraStreamTicket(sessionId: string) {
  const response = await apiClient.post<CommonResponse<GuardianCameraStreamTicket>>(
    `${GUARDIAN_CAMERA_BASE}/${sessionId}/stream-ticket`,
  );
  return getResponseData<GuardianCameraStreamTicket>(response);
}

// 백엔드 도메인으로 직접 붙는 주소 — Next.js 프록시를 거치지 않는다
export function getGuardianCameraStreamUrl(sessionId: string, ticket: string) {
  const domain = process.env.NEXT_PUBLIC_API_DOMAIN?.replace(/\/$/, '') ?? '';
  return `${domain}/api/camera/stream/${sessionId}/mjpeg?ticket=${encodeURIComponent(ticket)}`;
}

// 에러 응답도 JSON(ApiResponse)이라 apiClient의 blob responseType을 쓰면 파싱이 깨진다 — fetch로 직접 처리
export async function fetchGuardianCameraLatestFrame(sessionId: string): Promise<Blob> {
  const token = getAccessToken();
  const response = await fetch(`/api${GUARDIAN_CAMERA_BASE}/${sessionId}/latest-frame`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
    const error: GuardianCameraFileError = { status: response.status, code: body?.code, message: body?.message };
    throw error;
  }

  return response.blob();
}
