import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/lib/api/responseData';
import { CommonResponse } from '../interface/common';
import { WardSosRequest, WardSosResponse } from '../interface/ward';

const WARD_BASE = '/ward';

export async function triggerWardSos(body?: WardSosRequest) {
  const response = await apiClient.post<CommonResponse<WardSosResponse>>(`${WARD_BASE}/sos`, body);
  return getResponseData<WardSosResponse>(response);
}
