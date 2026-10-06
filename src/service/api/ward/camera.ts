// 피보호자(WARD)의 이상감지 카메라 등록·관리 API
// Swagger 그룹: "피보호자 - 카메라" (/api/ward/camera/**)
// sessionId·deviceId는 전부 서버가 발급한다. 등록은 멱등 — 같은 deviceId로 다시
// 등록하면 새 카메라가 생기지 않고 기존 sessionId를 재사용하며 label만 갱신된다.

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { RegisterWardCameraReq, UpdateWardCameraReq, WardCamera } from '../../interface/ward/camera';

const WARD_CAMERA_BASE = '/ward/camera';

// 카메라 등록(또는 재등록). deviceId를 생략하면 서버가 신규 발급
export async function registerWardCamera(body: RegisterWardCameraReq) {
  const response = await apiClient.post<CommonResponse<WardCamera>>(WARD_CAMERA_BASE, body);
  return getResponseData<WardCamera>(response);
}

// 본인이 등록한 카메라 목록(방별 최신순)
export async function getWardCameras() {
  const response = await apiClient.get<CommonResponse<WardCamera[]>>(WARD_CAMERA_BASE);
  return getResponseData<WardCamera[]>(response) ?? [];
}

// 방 이름 변경 / 사용 켜고 끄기 (보낸 필드만 갱신)
export async function updateWardCamera(id: number, body: UpdateWardCameraReq) {
  const response = await apiClient.patch<CommonResponse<WardCamera>>(`${WARD_CAMERA_BASE}/${id}`, body);
  return getResponseData<WardCamera>(response);
}

// 카메라 삭제
export async function deleteWardCamera(id: number) {
  return apiClient.delete<CommonResponse<null>>(`${WARD_CAMERA_BASE}/${id}`);
}
