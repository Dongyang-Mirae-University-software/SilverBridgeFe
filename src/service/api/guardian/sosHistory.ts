// 보호자(GUARDIAN)의 피보호자 SOS 이력 조회 API
// Swagger 그룹: "보호자 - SOS 이력" (/api/guardian/sos/history)
// ACTIVE 연결된 피보호자의 이력만 보임 (연결 해제 시 과거 이력도 비공개)

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { IGuardianSosHistoryItem, PageResponse } from '../../interface/guardian/sosHistory';

const GUARDIAN_SOS_BASE = '/guardian/sos';

export interface GetGuardianSosHistoryParams {
  wardId?: string; // 특정 피보호자만 조회. 생략하면 연결된 전원의 이력을 합쳐서 반환
  page?: number; // 0부터 시작
  size?: number; // 서버에서 최대 50으로 제한됨
}

// 최신순 페이징 이력 조회
export async function getGuardianSosHistory(params: GetGuardianSosHistoryParams = {}) {
  const response = await apiClient.get<CommonResponse<PageResponse<IGuardianSosHistoryItem>>>(
    `${GUARDIAN_SOS_BASE}/history`,
    { params },
  );
  return getResponseData<PageResponse<IGuardianSosHistoryItem>>(response);
}
