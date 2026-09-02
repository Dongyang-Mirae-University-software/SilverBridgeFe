// 피보호자(WARD)의 긴급 SOS 발생 API
// Swagger 그룹: "피보호자 - SOS" (/api/ward/sos)
// body 없이 호출해도 되고(SOS_BUTTON, 위치 미상), 보호자 카드로 직접 전화할 때는
// { triggerType: 'GUARDIAN_CALL' }을 같이 보내야 그 통화가 이력에 남음

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { WardSosRequest, WardSosResponse } from '../../interface/ward/sos';

const WARD_BASE = '/ward';

export async function triggerWardSos(body?: WardSosRequest) {
  const response = await apiClient.post<CommonResponse<WardSosResponse>>(`${WARD_BASE}/sos`, body);
  return getResponseData<WardSosResponse>(response);
}
