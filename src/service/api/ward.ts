import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../interface/common';
import { WardSosResponse } from '../interface/ward';

const WARD_BASE = '/ward';

export async function triggerWardSos() {
  return apiClient.post<CommonResponse<WardSosResponse>>(`${WARD_BASE}/sos`);
}
