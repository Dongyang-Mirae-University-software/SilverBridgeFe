import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../../interface/common';
import { IConnectionItem, IGuardianConnectionRequestReq } from '../../interface/connection';

const GUARDIAN_CONNECTION_BASE = '/guardian/connection';

export async function requestWardConnection(body: IGuardianConnectionRequestReq) {
  return apiClient.post<CommonResponse<null>>(`${GUARDIAN_CONNECTION_BASE}/request`, body);
}

export async function getGuardianConnections() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_CONNECTION_BASE}/select`);
}

export async function getGuardianConnectionRequests() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_CONNECTION_BASE}/requests`);
}

export async function disconnectGuardianConnection(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${GUARDIAN_CONNECTION_BASE}/disconnection/${connectionId}`);
}

export async function cancelGuardianConnectionRequest(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${GUARDIAN_CONNECTION_BASE}/cancel/${connectionId}`);
}
