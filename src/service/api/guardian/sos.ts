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
