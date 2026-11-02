export type AdminCameraLiveStatus = 'LIVE' | 'OFFLINE';
export type AdminCameraStatusFilter = 'ALL' | AdminCameraLiveStatus;

export interface AdminCameraItem {
  cameraId: number;
  sessionId: string;
  room: string;
  wardId: string;
  wardName: string | null;
  wardAddress: string | null;
  isActive: boolean;
  registeredAt: string | null;
  liveStatus: AdminCameraLiveStatus | null;
}

export interface AdminCameraPage {
  content: AdminCameraItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AdminCameraSummary {
  aiConnected: boolean;
  registered: number;
  maxTotal: number | null;
  live: number | null;
  offline: number | null;
  totalWards: number;
  wardsWithoutCamera: number;
}

export interface AdminCameraListParams {
  status: AdminCameraStatusFilter;
  q?: string;
  page: number;
  size: number;
}
