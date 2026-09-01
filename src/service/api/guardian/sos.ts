import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../../interface/common';
import { IGuardianSosHistoryItem, PageResponse } from '../../interface/sos';

const GUARDIAN_SOS_BASE = '/guardian/sos';

export interface GetGuardianSosHistoryParams {
  wardId?: string;
  page?: number;
  size?: number;
}

export async function getGuardianSosHistory(params: GetGuardianSosHistoryParams = {}) {
  return apiClient.get<CommonResponse<PageResponse<IGuardianSosHistoryItem>>>(`${GUARDIAN_SOS_BASE}/history`, {
    params,
  });
}

export function getGuardianSosHistoryData(response: unknown): PageResponse<IGuardianSosHistoryItem> | null {
  const body = response as
    | CommonResponse<PageResponse<IGuardianSosHistoryItem>>
    | { data?: CommonResponse<PageResponse<IGuardianSosHistoryItem>> | PageResponse<IGuardianSosHistoryItem> }
    | undefined;

  if (!body) return null;

  const data = body.data;
  if (data && typeof data === 'object' && 'data' in data) {
    return (data as CommonResponse<PageResponse<IGuardianSosHistoryItem>>).data ?? null;
  }

  return (data as PageResponse<IGuardianSosHistoryItem> | undefined) ?? null;
}
