import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../interface/common';
import { IAnnouncement } from '../interface/announcement';

const BASE = '/commonness/announcement';

export async function getAnnouncements() {
  return apiClient.get<CommonResponse<IAnnouncement[]>>(`${BASE}/select`);
}

export async function getAnnouncementDetail(id: number) {
  return apiClient.get<CommonResponse<IAnnouncement>>(`${BASE}/select/detail/${id}`);
}
