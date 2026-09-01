import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../interface/common';
import { WardSosRequest, WardSosResponse } from '../interface/ward';

const WARD_BASE = '/ward';

export async function triggerWardSos(body?: WardSosRequest) {
  const response = await apiClient.post<CommonResponse<WardSosResponse>>(`${WARD_BASE}/sos`, body);
  return getWardSosResponseData(response);
}

function getWardSosResponseData(response: unknown): WardSosResponse | null {
  const body = response as
    | CommonResponse<WardSosResponse>
    | { data?: CommonResponse<WardSosResponse> | WardSosResponse }
    | undefined;

  if (!body) return null;

  const data = body.data;
  if (data && typeof data === 'object' && 'data' in data) {
    return (data as CommonResponse<WardSosResponse>).data ?? null;
  }

  return (data as WardSosResponse | undefined) ?? null;
}
