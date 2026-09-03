// 피보호자(WARD)의 보호자 연결 관련 API
// Swagger 그룹: "피보호자 - 연결" (/api/ward/connection/**)

import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../../interface/common';
import { IConnectionItem, IWardPendingConnectionRequest } from '../../interface/connection';
import { getConnectionResponseBody } from '@/utils/api/connectionResponse';

const WARD_CONNECTION_BASE = '/ward/connection';

// 보호자가 보낸 연결 요청 수락
export async function acceptWardConnection(connectionId: number) {
  return apiClient.post<CommonResponse<null>>(`${WARD_CONNECTION_BASE}/${connectionId}/accept`);
}

// 연결된(ACTIVE) 보호자 목록만 조회
export async function getWardActiveConnections() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${WARD_CONNECTION_BASE}/active`);
}

// 아직 수락하지 않은(PENDING) 연결 요청 목록 조회
export async function getWardPendingConnectionRequests() {
  return apiClient.get<CommonResponse<IWardPendingConnectionRequest[]>>(`${WARD_CONNECTION_BASE}/pending`);
}

// 화면 목록용: ACTIVE 연결 + 수락 대기 요청을 한 번에 합쳐서 반환
// ward API는 active/pending 응답 형태가 나뉘어 있어 프론트에서 병합
export async function getWardConnections(): Promise<CommonResponse<IConnectionItem[]>> {
  const [activeResult, pendingResult] = await Promise.allSettled([getWardActiveConnections(), getWardPendingConnectionRequests()]);

  const activeBody = activeResult.status === 'fulfilled' ? getConnectionResponseBody(activeResult.value) : null;
  const pendingBody = pendingResult.status === 'fulfilled' ? getWardPendingConnectionBody(pendingResult.value) : null;

  return {
    code: activeBody?.code ?? pendingBody?.code ?? 200,
    success: activeBody?.success ?? pendingBody?.success ?? true,
    message: activeBody?.message || pendingBody?.message,
    data: mergeWardConnections(activeBody?.data ?? [], pendingBody?.data ?? []),
  };
}

// getWardPendingConnectionRequests 응답 봉투가 한 겹인지 두 겹인지 몰라도 안전하게 꺼내는 헬퍼
function getWardPendingConnectionBody(response: unknown): CommonResponse<IWardPendingConnectionRequest[]> | null {
  const body = response as
    | CommonResponse<IWardPendingConnectionRequest[]>
    | { data?: CommonResponse<IWardPendingConnectionRequest[]> | IWardPendingConnectionRequest[] }
    | undefined;

  if (!body) return null;
  if (Array.isArray(body.data)) return { ...body, data: body.data };

  const nestedBody = body.data;
  if (nestedBody && typeof nestedBody === 'object' && 'data' in nestedBody) {
    return nestedBody as CommonResponse<IWardPendingConnectionRequest[]>;
  }

  return body as CommonResponse<IWardPendingConnectionRequest[]>;
}

function mergeWardConnections(
  active: IConnectionItem[],
  pending: IWardPendingConnectionRequest[],
): IConnectionItem[] {
  const activeConnections = active.map(connection => ({ ...connection, status: 'ACTIVE' as const }));
  const pendingConnections = pending.map(mapWardPendingRequestToConnection);
  return [...activeConnections, ...pendingConnections];
}

// 보호자 요청 거절 (PENDING 상태에서만 가능)
export async function refuseWardConnectionRequest(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${WARD_CONNECTION_BASE}/request/${connectionId}/refusal`);
}

// 연결 해제 (ACTIVE 상태에서만 가능)
export async function disconnectWardConnection(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${WARD_CONNECTION_BASE}/disconnection/${connectionId}`);
}

// IWardPendingConnectionRequest(요청 전용 응답 모양)를 화면이 공통으로 쓰는 IConnectionItem 모양으로 변환
function mapWardPendingRequestToConnection(request: IWardPendingConnectionRequest): IConnectionItem {
  return {
    connectedAt: null,
    createdAt: request.requestedAt,
    id: request.connectionId,
    partnerAddress: null,
    partnerAddressDetail: null,
    partnerBirthDate: null,
    partnerEmail: null,
    partnerGender: null,
    partnerName: request.guardianName,
    partnerPhone: request.guardianPhone,
    partnerPostcode: null,
    partnerProfileImage: null,
    partnerUserId: request.guardianId,
    relation: request.relation,
    requester: false,
    status: 'PENDING',
  };
}
