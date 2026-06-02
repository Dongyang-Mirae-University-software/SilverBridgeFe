import { streamClient } from '@/lib/api/streamClient';
import type { CreateStreamSessionReq, RegisterCameraReq, StreamSession } from '../interface/streamSession';

export async function createStreamSession(body: CreateStreamSessionReq): Promise<StreamSession> {
  const res = await streamClient.post<unknown>('/v1/stream-sessions', body);
  const raw = res.data as Record<string, unknown>;
  if (raw?.data && typeof raw.data === 'object') return raw.data as StreamSession;
  return raw as unknown as StreamSession;
}

export async function uploadFrame(sessionId: string, jpeg: Blob): Promise<void> {
  const form = new FormData();
  form.append('frame', jpeg, 'frame.jpg');
  await streamClient.post(`/v1/stream-sessions/${sessionId}/frame`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function stopStreamSession(sessionId: string): Promise<void> {
  await streamClient.post(`/v1/stream-sessions/${sessionId}/stop`);
}

export async function registerCamera(body: RegisterCameraReq): Promise<unknown> {
  const res = await streamClient.post<unknown>('/v1/cameras', body);
  const raw = res.data as Record<string, unknown>;
  if (raw?.data) return raw.data;
  return raw;
}

export async function getCameraByIdentifier(identifier: string): Promise<unknown | null> {
  try {
    const res = await streamClient.get<unknown>(`/v1/cameras/by-identifier/${encodeURIComponent(identifier)}`);
    const raw = res.data as Record<string, unknown>;
    return (raw?.data ?? raw) || null;
  } catch {
    return null;
  }
}

export async function ensureCameraRegistered(identifier: string, name: string): Promise<void> {
  const existing = await getCameraByIdentifier(identifier);
  if (existing) return;
  await registerCamera({
    cameraNo: identifier,
    identifier,
    name: name || identifier,
    streamUrl: '',
    streamType: 'rtsp',
    isActive: true,
  });
}
