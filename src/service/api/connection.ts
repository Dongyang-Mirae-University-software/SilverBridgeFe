import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../interface/common';
import { IConnectionItem, IGuardianConnectionRequestReq, IWardPendingConnectionRequest } from '../interface/connection';

const GUARDIAN_BASE = '/api/guardian';
const WARD_BASE = '/api/ward';

export async function requestWardConnection(body: IGuardianConnectionRequestReq) {
  return apiClient.post<CommonResponse<null>>(`${GUARDIAN_BASE}/connection/request`, body);
}

export async function getGuardianConnections() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_BASE}/connection/select`);
}

export async function disconnectGuardianConnection(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${GUARDIAN_BASE}/connection/disconnection/${connectionId}`);
}

export async function cancelGuardianConnectionRequest(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${GUARDIAN_BASE}/connection/cancel/${connectionId}`);
}

export async function acceptWardConnection(connectionId: number) {
  return apiClient.post<CommonResponse<null>>(`${WARD_BASE}/connection/${connectionId}/accept`);
}

export async function getWardActiveConnections(): Promise<CommonResponse<IConnectionItem[]>> {
  return apiClient.get(`${WARD_BASE}/connection/active`) as Promise<CommonResponse<IConnectionItem[]>>;
}

export async function getWardPendingConnectionRequests(): Promise<CommonResponse<IWardPendingConnectionRequest[]>> {
  return apiClient.get(`${WARD_BASE}/connection/pending`) as Promise<CommonResponse<IWardPendingConnectionRequest[]>>;
}

export async function getWardConnections(): Promise<CommonResponse<IConnectionItem[]>> {
  const [activeResponse, pendingResponse] = await Promise.all([
    getWardActiveConnections(),
    getWardPendingConnectionRequests(),
  ]);
  const activeConnections = activeResponse.data.map(connection => ({
    ...connection,
    status: 'ACTIVE' as const,
  }));
  const pendingConnections = pendingResponse.data.map(mapWardPendingRequestToConnection);

  return {
    code: activeResponse.code ?? pendingResponse.code ?? 200,
    success: activeResponse.success ?? pendingResponse.success,
    message: activeResponse.message || pendingResponse.message,
    data: [...activeConnections, ...pendingConnections],
  };
}

export async function disconnectWardConnection(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${WARD_BASE}/connection/disconnection/${connectionId}`);
}

export async function refuseWardConnectionRequest(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${WARD_BASE}/connection/request/${connectionId}/refusal`);
}

function mapWardPendingRequestToConnection(request: IWardPendingConnectionRequest): IConnectionItem {
  return {
    connectedAt: null,
    createdAt: request.requestedAt,
    id: request.connectionId,
    partnerAddress: null,
    partnerAddressDetail: null,
    partnerName: request.guardianName,
    partnerPhone: request.guardianPhone,
    partnerProfileImage: null,
    partnerUserId: request.guardianId,
    relation: request.relation,
    requester: false,
    status: 'PENDING',
  };
}
