import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '@/service/interface/common';
import {
  AdminHospitalCreateRequest,
  AdminHospitalDepartment,
  AdminHospitalItem,
  AdminHospitalListParams,
  AdminHospitalPage,
  AdminHospitalStatus,
  AdminHospitalStatusUpdateRequest,
  AdminHospitalSummary,
  AdminHospitalUpdateRequest,
} from '@/service/interface/admin/hospital';
import { getResponseData } from '@/utils/api/responseData';

const BASE = '/admin/hospital';

export async function getAdminHospitals(params: AdminHospitalListParams) {
  const response = await apiClient.get<CommonResponse<AdminHospitalPage>>(BASE, { params });
  return getResponseData<AdminHospitalPage>(response);
}

export async function getAdminHospitalSummary() {
  const response = await apiClient.get<CommonResponse<AdminHospitalSummary>>(`${BASE}/summary`);
  return getResponseData<AdminHospitalSummary>(response);
}

export async function createAdminHospital(body: AdminHospitalCreateRequest) {
  const response = await apiClient.post<CommonResponse<AdminHospitalItem>>(BASE, body);
  return getResponseData<AdminHospitalItem>(response);
}

export async function updateAdminHospital(hospitalId: number, body: AdminHospitalUpdateRequest) {
  const response = await apiClient.put<CommonResponse<AdminHospitalItem>>(`${BASE}/${hospitalId}`, body);
  return getResponseData<AdminHospitalItem>(response);
}

export const deleteAdminHospital = (hospitalId: number) => apiClient.delete(`${BASE}/${hospitalId}`);

export async function updateAdminHospitalStatus(hospitalId: number, body: AdminHospitalStatusUpdateRequest) {
  const response = await apiClient.put<CommonResponse<AdminHospitalStatus>>(`${BASE}/${hospitalId}/status`, body);
  return getResponseData<AdminHospitalStatus>(response);
}

export async function createAdminHospitalDepartment(hospitalId: number, name: string) {
  const response = await apiClient.post<CommonResponse<AdminHospitalDepartment>>(`${BASE}/${hospitalId}/department`, { name });
  return getResponseData<AdminHospitalDepartment>(response);
}

export async function updateAdminHospitalDepartment(hospitalId: number, departmentId: number, name: string) {
  const response = await apiClient.put<CommonResponse<AdminHospitalDepartment>>(`${BASE}/${hospitalId}/department/${departmentId}`, { name });
  return getResponseData<AdminHospitalDepartment>(response);
}

export const deleteAdminHospitalDepartment = (hospitalId: number, departmentId: number) => apiClient.delete(`${BASE}/${hospitalId}/department/${departmentId}`);
