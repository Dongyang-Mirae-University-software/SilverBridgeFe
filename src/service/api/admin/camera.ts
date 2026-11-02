import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '@/service/interface/common';
import { AdminCameraListParams, AdminCameraPage, AdminCameraSummary } from '@/service/interface/admin/camera';
import { getResponseData } from '@/utils/api/responseData';

const ADMIN_CAMERA_BASE = '/admin/camera';

export async function getAdminCameras(params: AdminCameraListParams) {
  const response = await apiClient.get<CommonResponse<AdminCameraPage>>(ADMIN_CAMERA_BASE, { params });
  return getResponseData<AdminCameraPage>(response);
}

export async function getAdminCameraSummary() {
  const response = await apiClient.get<CommonResponse<AdminCameraSummary>>(`${ADMIN_CAMERA_BASE}/summary`);
  return getResponseData<AdminCameraSummary>(response);
}
