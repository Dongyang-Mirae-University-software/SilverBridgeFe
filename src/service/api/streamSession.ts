import { streamClient } from '@/lib/api/streamClient';
import type { CreateStreamSessionReq, StreamSession } from '../interface/streamSession';

export async function createStreamSession(body: CreateStreamSessionReq): Promise<StreamSession> {
  const res = await streamClient.post<unknown>('/v1/stream-sessions', body);
  const raw = res.data as Record<string, unknown>;
  if (raw?.data && typeof raw.data === 'object') return raw.data as StreamSession;
  return raw as unknown as StreamSession;
}

// timeoutMs: 이 시간 안에 끝나지 않으면 끊고 실패로 처리한다(막힌 연결에 오래된 프레임이 매달리지 않게)
export async function uploadFrame(sessionId: string, jpeg: Blob, timeoutMs?: number): Promise<void> {
  const form = new FormData();
  form.append('frame', jpeg, 'frame.jpg');
  await streamClient.post(`/v1/stream-sessions/${sessionId}/frame`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...(timeoutMs ? { timeout: timeoutMs } : {}),
  });
}

export async function stopStreamSession(sessionId: string): Promise<void> {
  await streamClient.post(`/v1/stream-sessions/${sessionId}/stop`);
}

// 탭을 닫거나 다른 화면으로 떠날 때 - 페이지가 내려가는 중에도 나가도록 keepalive 로 보낸다.
// 프록시는 로그인 쿠키로 확인하므로 같은 출처 요청이면 따로 헤더가 필요 없다. 실패는 삼킨다(QA CAM-A21)
export function stopStreamSessionOnLeave(sessionId: string) {
  try {
    void fetch(`/api/streams/v1/stream-sessions/${encodeURIComponent(sessionId)}/stop`, {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {});
  } catch {
    // fetch 자체가 없는 환경(서버 렌더 등)은 넘긴다
  }
}
