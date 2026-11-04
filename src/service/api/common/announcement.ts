// 공지사항 조회 API (로그인한 모든 역할 공용)
// Swagger 그룹: "공통 - 공지사항" (/api/commonness/announcement/**)
// 공지 작성·수정은 관리자 전용이라 여기 없음

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { IAnnouncement } from '../../interface/common/announcement';

const BASE = '/commonness/announcement';

// 공지 목록 조회 - 최신순 배열. content는 앞 100자 미리보기(전체는 상세 조회). size 생략 시 20, 최대 50
export async function getAnnouncements(params: { page?: number; size?: number } = {}) {
  const response = await apiClient.get<CommonResponse<IAnnouncement[]>>(`${BASE}/select`, { params });
  return getResponseData<IAnnouncement[]>(response) ?? [];
}

// 공지 상세 조회 - content 전체. 부를 때마다 조회수가 1 오른다
export async function getAnnouncementDetail(id: number) {
  const response = await apiClient.get<CommonResponse<IAnnouncement>>(`${BASE}/select/detail/${id}`);
  return getResponseData<IAnnouncement>(response);
}
