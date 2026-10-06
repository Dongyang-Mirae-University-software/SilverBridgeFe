// 보호자(GUARDIAN)의 고객센터 문의 작성·조회 API
// Swagger 그룹: "보호자 - 문의" (/api/guardian/inquiry/**)

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { CreateGuardianInquiryReq, GetGuardianInquiriesParams, GuardianInquiry } from '../../interface/guardian/inquiry';

const GUARDIAN_INQUIRY_BASE = '/guardian/inquiry';

// 본인이 작성한 문의를 최신순으로 반환. 응답은 봉투의 data가 배열 그대로(페이징 메타 없음)
export async function getGuardianInquiries(params: GetGuardianInquiriesParams = {}) {
  const response = await apiClient.get<CommonResponse<GuardianInquiry[]>>(GUARDIAN_INQUIRY_BASE, { params });
  return getResponseData<GuardianInquiry[]>(response) ?? [];
}

// 최초 상태는 WAITING. 분당 5회·시간당 30회 초과 시 429
export async function createGuardianInquiry(body: CreateGuardianInquiryReq) {
  const response = await apiClient.post<CommonResponse<GuardianInquiry>>(GUARDIAN_INQUIRY_BASE, body);
  return getResponseData<GuardianInquiry>(response);
}

// 타인 문의 ID로 조회하면 403
export async function getGuardianInquiryDetail(id: number) {
  const response = await apiClient.get<CommonResponse<GuardianInquiry>>(`${GUARDIAN_INQUIRY_BASE}/${id}`);
  return getResponseData<GuardianInquiry>(response);
}
