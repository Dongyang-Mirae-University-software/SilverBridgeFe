import { streamClient } from '@/lib/api/streamClient';
import type { ChatLogItem, ChatRequest, ChatResponse } from '../interface/chat';

export async function sendChatMessage(body: ChatRequest): Promise<ChatResponse> {
  const res = await streamClient.post<unknown>('/v1/chat', body);
  const raw = res.data as Record<string, unknown>;
  // { success, message, data: ChatResponse } 래핑 구조 언래핑
  if (raw?.data && typeof raw.data === 'object') return raw.data as ChatResponse;
  return raw as unknown as ChatResponse;
}

export async function getChatLogs(userId: string): Promise<ChatLogItem[]> {
  const res = await streamClient.get<unknown>(`/v1/chat/logs?userId=${encodeURIComponent(userId)}`);
  const raw = res.data;
  if (Array.isArray(raw)) return raw as ChatLogItem[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const nested = obj.logs ?? obj.data ?? obj.items;
    if (Array.isArray(nested)) return nested as ChatLogItem[];
  }
  return [];
}

export async function getChatLogDetail(chatId: string): Promise<ChatLogItem> {
  const res = await streamClient.get<ChatLogItem>(`/v1/chat/logs/${chatId}`);
  return res.data;
}
