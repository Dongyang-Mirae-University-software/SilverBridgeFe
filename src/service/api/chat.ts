import axios from 'axios';
import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import type { CommonResponse } from '@/service/interface/common';
import type { ChatLogItem, ChatRequest, ChatResponse } from '../interface/chat';

export async function sendChatMessage(body: ChatRequest): Promise<ChatResponse> {
  const response = await apiClient.post<CommonResponse<ChatResponse>>('/guardian/chat', body, { timeout: 140_000 });
  const data = getResponseData<ChatResponse>(response);
  if (!data || typeof data.reply !== 'string') throw new Error('챗봇 응답 형식이 올바르지 않습니다.');
  return data;
}

export async function getChatLogs(): Promise<ChatLogItem[]> {
  const response = await apiClient.get<CommonResponse<ChatLogItem[]>>('/guardian/chat/logs', { timeout: 15_000 });
  const data = getResponseData<unknown>(response);
  return Array.isArray(data) ? (data as ChatLogItem[]) : [];
}

export async function getChatLogDetail(chatId: string): Promise<ChatLogItem> {
  const response = await apiClient.get<CommonResponse<ChatLogItem>>(`/guardian/chat/logs/${chatId}`, { timeout: 15_000 });
  const data = getResponseData<ChatLogItem>(response);
  if (!data) throw new Error('상담 기록을 찾을 수 없습니다.');
  return data;
}

export function getChatErrorMessage(error: unknown) {
  if (!axios.isAxiosError<{ code?: string }>(error)) return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

  const code = error.response?.data?.code;
  if (code === 'CHAT_LIMIT_EXCEEDED') return '이전 상담의 답변을 기다리고 있어요. 잠시 후 다시 시도해 주세요.';
  if (code === 'CHAT_TIMEOUT') return '답변이 오래 걸리고 있어요. 다시 시도해 주세요.';
  if (code === 'CHAT_UNAVAILABLE') return 'AI 상담 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  if (code === 'CHAT_INVALID_REQUEST') return '입력 내용을 확인한 뒤 다시 보내주세요.';
  if (code === 'TOO_MANY_REQUESTS') {
    const retryAfter = error.response?.headers?.['retry-after'];
    return retryAfter ? `요청이 많아요. ${retryAfter}초 후 다시 시도해 주세요.` : '요청이 많아요. 잠시 후 다시 시도해 주세요.';
  }

  return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}
