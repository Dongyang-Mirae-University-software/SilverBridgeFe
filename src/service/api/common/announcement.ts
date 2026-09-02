import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../../interface/common';
import { IAnnouncement } from '../../interface/common/announcement';

const BASE = '/commonness/announcement';

function getResponseData<T>(response: unknown): T {
  const body = response as CommonResponse<T> | { data?: CommonResponse<T> | T };
  const data = body.data;

  if (data && typeof data === 'object' && 'data' in data) {
    return (data as CommonResponse<T>).data as T;
  }

  return data as T;
}

export async function getAnnouncements() {
  const response = await apiClient.get<CommonResponse<IAnnouncement[]>>(`${BASE}/select`);
  return getResponseData<IAnnouncement[]>(response);
}

export async function getAnnouncementDetail(id: number) {
  const response = await apiClient.get<CommonResponse<IAnnouncement>>(`${BASE}/select/detail/${id}`);
  return getResponseData<IAnnouncement>(response);
}
