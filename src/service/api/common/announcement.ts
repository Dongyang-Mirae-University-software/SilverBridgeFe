// 공지사항 조회 API (로그인한 모든 역할 공용)
// Swagger 그룹: "공통 - 공지사항" (/api/commonness/announcement/**)
// 공지 작성·수정은 관리자 전용이라 여기 없음

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/lib/api/responseData';
import { CommonResponse } from '../../interface/common';
import { IAnnouncement } from '../../interface/common/announcement';

const BASE = '/commonness/announcement';

// 공지 목록 조회
export async function getAnnouncements() {
  const response = await apiClient.get<CommonResponse<IAnnouncement[]>>(`${BASE}/select`);
  return getResponseData<IAnnouncement[]>(response) ?? [];
}

// 공지 상세 조회
export async function getAnnouncementDetail(id: number) {
  const response = await apiClient.get<CommonResponse<IAnnouncement>>(`${BASE}/select/detail/${id}`);
  return getResponseData<IAnnouncement>(response);
}
