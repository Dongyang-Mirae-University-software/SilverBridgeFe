import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '@/service/interface/common';
import { AdminInquiryDetail, AdminInquiryListParams, AdminInquiryListResult } from '@/service/interface/admin/inquiry';
import { getResponseData } from '@/utils/api/responseData';

const ADMIN_INQUIRY_BASE = '/admin/inquiry';

export async function getAdminInquiries(params: AdminInquiryListParams) {
  const response = await apiClient.get<CommonResponse<AdminInquiryListResult>>(ADMIN_INQUIRY_BASE, { params });
  return getResponseData<AdminInquiryListResult>(response);
}

export async function getAdminInquiryDetail(id: number) {
  const response = await apiClient.get<CommonResponse<AdminInquiryDetail>>(`${ADMIN_INQUIRY_BASE}/${id}`);
  return getResponseData<AdminInquiryDetail>(response);
}

export async function answerAdminInquiry({ id, answer }: { id: number; answer: string }) {
  const response = await apiClient.post<CommonResponse<AdminInquiryDetail>>(`${ADMIN_INQUIRY_BASE}/${id}/answer`, { answer });
  return getResponseData<AdminInquiryDetail>(response);
}
