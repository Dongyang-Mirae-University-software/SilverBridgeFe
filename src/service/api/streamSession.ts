import { streamClient } from '@/lib/api/streamClient';
import type { CreateStreamSessionReq, StreamSession } from '../interface/streamSession';

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
