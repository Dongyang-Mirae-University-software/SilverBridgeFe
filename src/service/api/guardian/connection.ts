// 보호자(GUARDIAN)의 피보호자 연결 관련 API
// Swagger 그룹: "보호자 - 연결" (/api/guardian/connection/**)

import { apiClient } from '@/lib/api/apiClient';
import { getConnectionResponseBody, mergeConnectionItems } from '@/utils/api/connectionResponse';
import { CommonResponse } from '../../interface/common';
import { IConnectionItem, IGuardianConnectionRequestReq } from '../../interface/connection';

const GUARDIAN_CONNECTION_BASE = '/guardian/connection';

// 피보호자에게 페어링(연결) 요청 보내기
export async function requestWardConnection(body: IGuardianConnectionRequestReq) {
  return apiClient.post<CommonResponse<null>>(`${GUARDIAN_CONNECTION_BASE}/request`, body);
}

// 내 피보호자 목록 조회: ACTIVE + PENDING 상태를 최신 요청순으로 반환
export async function getGuardianSelectedConnections() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_CONNECTION_BASE}/select`);
}

export async function getGuardianActiveConnections() {
  return getGuardianSelectedConnections();
}

// 내가 보낸 연결 요청 이력(수락 대기 PENDING 포함) 조회
export async function getGuardianConnectionRequests() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_CONNECTION_BASE}/requests`);
}

// 화면 목록용: /select 응답을 공통 화면 데이터로 정규화
export async function getGuardianConnections(): Promise<CommonResponse<IConnectionItem[]>> {
  const response = await getGuardianSelectedConnections();
  const body = getConnectionResponseBody(response);

  return {
    code: body?.code ?? 200,
    success: body?.success ?? true,
    message: body?.message,
    data: mergeConnectionItems(body?.data ?? []),
  };
}

// ACTIVE 상태 연결 해제
export async function disconnectGuardianConnection(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${GUARDIAN_CONNECTION_BASE}/disconnection/${connectionId}`);
}

// 아직 수락 안 된(PENDING) 요청 취소
export async function cancelGuardianConnectionRequest(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${GUARDIAN_CONNECTION_BASE}/cancel/${connectionId}`);
}
