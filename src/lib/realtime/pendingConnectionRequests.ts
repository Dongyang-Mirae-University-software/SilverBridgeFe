import { IConnectionItem } from '@/service/interface/connection';

const PENDING_CONNECTION_REQUESTS_KEY = 'careai_pending_connection_requests';
export const PENDING_CONNECTION_REQUESTS_EVENT = 'careai:pending-connection-requests';

interface PendingConnectionRequest {
  connectionId: number;
  createdAt: string;
  from?: string;
}

function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

function readRequests() {
  const rawRequests = getSessionStorage()?.getItem(PENDING_CONNECTION_REQUESTS_KEY);
  if (!rawRequests) return [];

  try {
    const requests = JSON.parse(rawRequests) as PendingConnectionRequest[];
    return Array.isArray(requests) ? requests : [];
  } catch {
    return [];
  }
}

function writeRequests(requests: PendingConnectionRequest[]) {
  getSessionStorage()?.setItem(PENDING_CONNECTION_REQUESTS_KEY, JSON.stringify(requests));
  window.dispatchEvent(new Event(PENDING_CONNECTION_REQUESTS_EVENT));
}

export function savePendingConnectionRequest(payload?: { connectionId?: number | string; from?: string }) {
  const connectionId = Number(payload?.connectionId);
  if (!Number.isFinite(connectionId)) return;

  const requests = readRequests();
  const previousRequest = requests.find(request => request.connectionId === connectionId);
  const nextRequest: PendingConnectionRequest = {
    connectionId,
    createdAt: previousRequest?.createdAt ?? new Date().toISOString(),
    from: payload?.from ?? previousRequest?.from,
  };
  const nextRequests = [nextRequest, ...requests.filter(request => request.connectionId !== connectionId)];

  writeRequests(nextRequests);
}

export function removePendingConnectionRequest(connectionId: number) {
  const requests = readRequests();
  const nextRequests = requests.filter(request => request.connectionId !== connectionId);

  writeRequests(nextRequests);
}

export function getPendingConnectionRequestItems(): IConnectionItem[] {
  return readRequests().map(request => ({
    connectedAt: null,
    createdAt: request.createdAt,
    id: request.connectionId,
    partnerName: request.from ? `보호자 ${request.from}` : '보호자 정보 확인 전',
    partnerProfileImage: null,
    partnerUserId: request.from ?? '확인 전',
    priority: 0,
    requester: false,
    status: 'PENDING',
  }));
}
