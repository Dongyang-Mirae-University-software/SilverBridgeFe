import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '@/service/interface/common';
import { AdminAnnouncementItem, AdminAnnouncementListParams, AdminAnnouncementPage, AdminAnnouncementSummary, AdminAnnouncementWriteRequest } from '@/service/interface/admin/announcement';
import { getResponseData } from '@/utils/api/responseData';

const BASE = '/admin/announcement';

function getPage(path: string, params: AdminAnnouncementListParams) {
  return apiClient.get<CommonResponse<AdminAnnouncementPage>>(path, { params }).then(response => getResponseData<AdminAnnouncementPage>(response));
}

function getItem(path: string) {
  return apiClient.get<CommonResponse<AdminAnnouncementItem>>(path).then(response => getResponseData<AdminAnnouncementItem>(response));
}

export const getAdminAnnouncements = (params: AdminAnnouncementListParams) => getPage(`${BASE}/select`, params);
export const getAdminAnnouncementDrafts = (params: AdminAnnouncementListParams) => getPage(`${BASE}/draft/select`, params);
export const getAdminAnnouncement = (id: number) => getItem(`${BASE}/select/detail/${id}`);
export const getAdminAnnouncementDraft = (id: number) => getItem(`${BASE}/draft/select/detail/${id}`);

export async function getAdminAnnouncementSummary() {
  const response = await apiClient.get<CommonResponse<AdminAnnouncementSummary>>(`${BASE}/summary`);
  return getResponseData<AdminAnnouncementSummary>(response);
}

export const createAdminAnnouncement = (body: AdminAnnouncementWriteRequest) => apiClient.post<CommonResponse<AdminAnnouncementItem>>(`${BASE}/create`, body).then(response => getResponseData<AdminAnnouncementItem>(response));
export const updateAdminAnnouncement = (id: number, body: AdminAnnouncementWriteRequest) => apiClient.put<CommonResponse<AdminAnnouncementItem>>(`${BASE}/update/${id}`, body).then(response => getResponseData<AdminAnnouncementItem>(response));
export const deleteAdminAnnouncement = (id: number) => apiClient.delete(`${BASE}/delete/${id}`);
export const createAdminAnnouncementDraft = (body: AdminAnnouncementWriteRequest) => apiClient.post<CommonResponse<AdminAnnouncementItem>>(`${BASE}/draft/create`, body).then(response => getResponseData<AdminAnnouncementItem>(response));
export const updateAdminAnnouncementDraft = (id: number, body: AdminAnnouncementWriteRequest) => apiClient.put<CommonResponse<AdminAnnouncementItem>>(`${BASE}/draft/update/${id}`, body).then(response => getResponseData<AdminAnnouncementItem>(response));
export const deleteAdminAnnouncementDraft = (id: number) => apiClient.delete(`${BASE}/draft/delete/${id}`);
export const publishAdminAnnouncementDraft = (id: number) => apiClient.post<CommonResponse<AdminAnnouncementItem>>(`${BASE}/draft/publish/${id}`).then(response => getResponseData<AdminAnnouncementItem>(response));
