import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../../interface/common';
import { IConnectionItem, IWardPendingConnectionRequest } from '../../interface/connection';
import { getConnectionResponseBody } from './connectionResponse';

const WARD_CONNECTION_BASE = '/ward/connection';

export async function acceptWardConnection(connectionId: number) {
  return apiClient.post<CommonResponse<null>>(`${WARD_CONNECTION_BASE}/${connectionId}/accept`);
}

export async function getWardActiveConnections() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${WARD_CONNECTION_BASE}/active`);
}

export async function getWardPendingConnectionRequests() {
  return apiClient.get<CommonResponse<IWardPendingConnectionRequest[]>>(`${WARD_CONNECTION_BASE}/pending`);
}

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
