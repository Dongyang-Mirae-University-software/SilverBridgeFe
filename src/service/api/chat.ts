import { apiClient } from '@/lib/api/apiClient';
import { getAuthRole } from '@/lib/auth/tokenStore';
import { getResponseData } from '@/utils/api/responseData';
import type { CommonResponse } from '@/service/interface/common';
import type { ChatLogItem, ChatRequest, ChatResponse } from '../interface/chat';
import { getChatErrorMessage, resolveChatBasePath } from './chatPolicy';

function getChatBasePath() {
  return resolveChatBasePath(getAuthRole());
}

export async function sendChatMessage(body: ChatRequest): Promise<ChatResponse> {
  const response = await apiClient.post<CommonResponse<ChatResponse>>(getChatBasePath(), body, { timeout: 150_000 });
  const data = getResponseData<ChatResponse>(response);
  if (!data || typeof data.reply !== 'string') throw new Error('챗봇 응답 형식이 올바르지 않습니다.');
  return data;
}

export async function getChatLogs(): Promise<ChatLogItem[]> {
  const response = await apiClient.get<CommonResponse<ChatLogItem[]>>(`${getChatBasePath()}/logs`, { timeout: 15_000 });
  const data = getResponseData<unknown>(response);
  return Array.isArray(data) ? (data as ChatLogItem[]) : [];
}

// 본인 기록만 서버가 토큰으로 결정한다. userId를 요청에 싣지 않는다
export async function getChatLogDetail(chatId: string): Promise<ChatLogItem> {
  const response = await apiClient.get<CommonResponse<ChatLogItem>>(`${getChatBasePath()}/logs/${encodeURIComponent(chatId)}`, {
    timeout: 15_000,
  });
  const data = getResponseData<ChatLogItem>(response);
  if (!data) throw new Error('상담 기록을 찾을 수 없습니다.');
  return data;
}

export { getChatErrorMessage };
