// 보호자(GUARDIAN)의 피보호자 연결 관련 API
// Swagger 그룹: "보호자 - 연결" (/api/guardian/connection/**)

import { apiClient } from '@/lib/api/apiClient';
import { getConnectionResponseBody, mergeConnectionItems } from '@/lib/api/connectionResponse';
import { CommonResponse } from '../../interface/common';
import { IConnectionItem, IGuardianConnectionRequestReq } from '../../interface/connection';

const GUARDIAN_CONNECTION_BASE = '/guardian/connection';

// 피보호자에게 페어링(연결) 요청 보내기
export async function requestWardConnection(body: IGuardianConnectionRequestReq) {
  return apiClient.post<CommonResponse<null>>(`${GUARDIAN_CONNECTION_BASE}/request`, body);
}

// 연결된(ACTIVE) 피보호자 목록만 조회
export async function getGuardianActiveConnections() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_CONNECTION_BASE}/select`);
}

// 내가 보낸 연결 요청 이력(수락 대기 PENDING 포함) 조회
export async function getGuardianConnectionRequests() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_CONNECTION_BASE}/requests`);
}

// 화면 목록용: ACTIVE 연결 + 요청 이력을 한 번에 합쳐서 반환
// (백엔드에 "전체 목록" API가 따로 없어서 두 API를 병렬 호출 후 프론트에서 병합함)
export async function getGuardianConnections(): Promise<CommonResponse<IConnectionItem[]>> {
  const [activeResult, requestResult] = await Promise.allSettled([
    getGuardianActiveConnections(),
    getGuardianConnectionRequests(),
  ]);

  const activeBody = activeResult.status === 'fulfilled' ? getConnectionResponseBody(activeResult.value) : null;
  const requestBody = requestResult.status === 'fulfilled' ? getConnectionResponseBody(requestResult.value) : null;

  return {
    code: activeBody?.code ?? requestBody?.code ?? 200,
    success: activeBody?.success ?? requestBody?.success ?? true,
    message: activeBody?.message || requestBody?.message,
    data: mergeConnectionItems(activeBody?.data ?? [], requestBody?.data ?? []),
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
