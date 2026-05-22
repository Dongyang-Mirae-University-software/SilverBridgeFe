import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../../interface/common';
import { IConnectionItem, IWardPendingConnectionRequest } from '../../interface/connection';

const WARD_CONNECTION_BASE = '/api/ward/connection';

export async function acceptWardConnection(connectionId: number) {
  return apiClient.post<CommonResponse<null>>(`${WARD_CONNECTION_BASE}/${connectionId}/accept`);
}

export async function getWardActiveConnections(): Promise<CommonResponse<IConnectionItem[]>> {
  return apiClient.get(`${WARD_CONNECTION_BASE}/active`) as Promise<CommonResponse<IConnectionItem[]>>;
}

export async function getWardPendingConnectionRequests(): Promise<CommonResponse<IWardPendingConnectionRequest[]>> {
  return apiClient.get(`${WARD_CONNECTION_BASE}/pending`) as Promise<CommonResponse<IWardPendingConnectionRequest[]>>;
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

export async function refuseWardConnectionRequest(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${WARD_CONNECTION_BASE}/request/${connectionId}/refusal`);
}

export async function disconnectWardConnection(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${WARD_CONNECTION_BASE}/disconnection/${connectionId}`);
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
