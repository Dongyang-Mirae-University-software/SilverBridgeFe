import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../interface/common';
import { IConnectionItem, IGuardianConnectionRequestReq } from '../interface/connection';

const GUARDIAN_BASE = '/api/guardian';
const WARD_BASE = '/api/ward';

export async function requestWardConnection(body: IGuardianConnectionRequestReq) {
  return apiClient.post<CommonResponse<null>>(`${GUARDIAN_BASE}/connection/request`, body);
}

export async function getGuardianConnections() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_BASE}/connection/select`);
}

export async function disconnectGuardianConnection(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${GUARDIAN_BASE}/disconnection/${connectionId}`);
}

export async function cancelGuardianConnectionRequest(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${GUARDIAN_BASE}/connection/cancel/${connectionId}`);
}

export async function acceptWardConnection(connectionId: number) {
  return apiClient.post<CommonResponse<null>>(`${WARD_BASE}/connection/${connectionId}/accept`);
}

export async function getWardConnections() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${WARD_BASE}/connection/select`);
}

export async function disconnectWardConnection(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${WARD_BASE}/disconnection/${connectionId}`);
}

export async function refuseWardConnectionRequest(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${WARD_BASE}/connection/request/${connectionId}/refusal`);
}
