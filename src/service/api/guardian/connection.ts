import { apiClient } from '@/lib/api/apiClient';
import { getConnectionResponseBody, mergeConnectionItems } from '@/lib/api/connectionResponse';
import { CommonResponse } from '../../interface/common';
import { IConnectionItem, IGuardianConnectionRequestReq } from '../../interface/connection';

const GUARDIAN_CONNECTION_BASE = '/guardian/connection';

export async function requestWardConnection(body: IGuardianConnectionRequestReq) {
  return apiClient.post<CommonResponse<null>>(`${GUARDIAN_CONNECTION_BASE}/request`, body);
}

export async function getGuardianActiveConnections() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_CONNECTION_BASE}/select`);
}

export async function getGuardianConnectionRequests() {
  return apiClient.get<CommonResponse<IConnectionItem[]>>(`${GUARDIAN_CONNECTION_BASE}/requests`);
}

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

export async function disconnectGuardianConnection(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${GUARDIAN_CONNECTION_BASE}/disconnection/${connectionId}`);
}

export async function cancelGuardianConnectionRequest(connectionId: number) {
  return apiClient.delete<CommonResponse<null>>(`${GUARDIAN_CONNECTION_BASE}/cancel/${connectionId}`);
}
