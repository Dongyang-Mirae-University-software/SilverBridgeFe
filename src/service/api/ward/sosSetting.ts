// 피보호자(WARD)의 SOS 동작 설정 조회·변경 API
// Swagger 그룹: "피보호자 - SOS 설정" (/api/ward/sos-setting)
// 설정한 적 없는 사용자는 GET이 기본값(CALL_119_AND_NOTIFY)을 돌려준다 — 별도 초기화 불필요

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { UpdateWardSosSettingReq, WardSosSetting } from '../../interface/ward/sosSetting';

const WARD_SOS_SETTING_BASE = '/ward/sos-setting';

export async function getWardSosSetting() {
  const response = await apiClient.get<CommonResponse<WardSosSetting>>(WARD_SOS_SETTING_BASE);
  return getResponseData<WardSosSetting>(response);
}

export async function updateWardSosSetting(body: UpdateWardSosSettingReq) {
  const response = await apiClient.put<CommonResponse<WardSosSetting>>(WARD_SOS_SETTING_BASE, body);
  return getResponseData<WardSosSetting>(response);
}
