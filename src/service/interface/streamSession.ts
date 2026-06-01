export interface CreateStreamSessionReq {
  sessionId: string;
  cameraIdentifier: string;
  deviceType: string;
}

export interface StreamSession {
  session_id: string;
  camera_identifier?: string;
  status?: 'running' | 'stopped';
  started_at?: string;
}

export interface RegisterCameraReq {
  cameraNo: string;
  identifier: string;
  name: string;
  streamUrl: string;
  streamType: string;
  targetUserId?: string;
  guardianUserId?: string;
  locationName?: string;
  isActive: boolean;
}
