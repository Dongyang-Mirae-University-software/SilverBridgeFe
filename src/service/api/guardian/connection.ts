// 보호자(GUARDIAN)의 피보호자 연결 관련 API
// Swagger 그룹: "보호자 - 연결" (/api/guardian/connection/**)

import { apiClient } from '@/lib/api/apiClient';
import { getConnectionResponseBody, mergeConnectionItems } from '@/utils/api/connectionResponse';
import { CommonResponse } from '../../interface/common';
import { IConnectionItem, IGuardianConnectionPreview, IGuardianConnectionRequestReq } from '../../interface/connection';

const GUARDIAN_CONNECTION_BASE = '/guardian/connection';

// /select 조회 시 좁힐 수 있는 상태값. ALL은 "전체 상태"가 아니라 ACTIVE + PENDING(진행 중인 연결)과 동일하며,
// 생략했을 때의 기본 동작과 같다. REFUSED/CANCELLED/DISCONNECTED 같은 종료 이력은 이 API가 다루지 않고 400을 반환한다.
export type WardListFilter = 'ACTIVE' | 'PENDING' | 'ALL';

// 피보호자에게 페어링(연결) 요청 보내기
export async function requestWardConnection(body: IGuardianConnectionRequestReq) {
  return apiClient.post<CommonResponse<null>>(`${GUARDIAN_CONNECTION_BASE}/request`, body);
}

// 링크로 전달받은 회원 ID의 연결 가능 여부를 가린 이름으로만 미리 확인한다.
export async function previewWardConnection(targetId: string) {
  const response = await apiClient.get<CommonResponse<IGuardianConnectionPreview>>(`${GUARDIAN_CONNECTION_BASE}/preview`, {
    params: { targetId },
  });
  const body = response as unknown as {
    data?: IGuardianConnectionPreview | CommonResponse<IGuardianConnectionPreview>;
  };
  const data = body.data;

  if (data && 'targetId' in data) return data;
  if (data && 'data' in data && data.data) return data.data;
  throw new Error('가족 정보를 확인하지 못했습니다.');
}

// 내 피보호자 목록 조회: status 생략 시 ACTIVE + PENDING 상태를 최신 요청순으로 반환
export async function getGuardianSelectedConnections(status?: WardListFilter) {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_CONNECTION_BASE}/select`, {
    params: status ? { status } : undefined,
  });
}

export async function getGuardianActiveConnections() {
  return getGuardianSelectedConnections();
}

// 내가 보낸 연결 요청 이력(수락 대기 PENDING 포함) 조회
export async function getGuardianConnectionRequests() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_CONNECTION_BASE}/requests`);
}

// 화면 목록용: /select 응답을 공통 화면 데이터로 정규화
export async function getGuardianConnections(status?: WardListFilter): Promise<CommonResponse<IConnectionItem[]>> {
  const response = await getGuardianSelectedConnections(status);
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
