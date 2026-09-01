import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../interface/common';
import { WardSosRequest, WardSosResponse } from '../interface/ward';

const WARD_BASE = '/ward';

export async function triggerWardSos(body?: WardSosRequest) {
  return apiClient.post<CommonResponse<WardSosResponse>>(`${WARD_BASE}/sos`, body);
}
