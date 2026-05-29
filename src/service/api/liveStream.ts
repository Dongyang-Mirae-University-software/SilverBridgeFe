import { streamClient } from '@/lib/api/streamClient';
import type { LiveStreamAnalysis, LiveStreamSession, LiveStreamStatus } from '../interface/liveStream';

export async function getLiveStreams(): Promise<LiveStreamSession[]> {
  const res = await streamClient.get<unknown>('/v1/live-streams');
  const raw = res.data;
  console.log('[LiveStreams] raw response:', JSON.stringify(raw));

  let list: unknown[] = [];

  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const nested = obj.sessions ?? obj.data ?? obj.items ?? obj.results;
    if (Array.isArray(nested)) list = nested;
  }

  // session_id 필드명 정규화 (id / sessionId / session_id 모두 허용)
  return list.map((item: unknown) => {
    const s = item as Record<string, unknown>;
    return {
      ...s,
      session_id: (s.session_id ?? s.sessionId ?? s.id ?? '') as string,
    } as LiveStreamSession;
  });
}

export async function getLiveStreamStatus(sessionId: string): Promise<LiveStreamStatus> {
  const res = await streamClient.get<LiveStreamStatus>(`/v1/live-streams/${sessionId}/status`);
  return res.data ?? {};
}

export async function getLiveStreamLatestAnalysis(sessionId: string): Promise<LiveStreamAnalysis> {
  const res = await streamClient.get<LiveStreamAnalysis>(`/v1/live-streams/${sessionId}/latest-analysis`);
  return res.data ?? {};
}
