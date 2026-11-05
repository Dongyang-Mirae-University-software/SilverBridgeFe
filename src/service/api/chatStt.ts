import { apiClient } from '@/lib/api/apiClient';
import { getAuthRole } from '@/lib/auth/tokenStore';
import { getResponseData } from '@/utils/api/responseData';
import type { CommonResponse } from '@/service/interface/common';
import { resolveChatBasePath } from './chatPolicy';

// 서버가 최대 30초 기다리므로 그보다 조금 길게 둔다
export const CHAT_STT_TIMEOUT_MS = 35_000;

// 녹음 → 글자. 역할별 경로(/ward/chat/stt · /guardian/chat/stt)는 챗과 같은 함수로 정한다.
// Content-Type: apiClient 기본값이 application/json이라 그대로 두면 axios가 FormData를 JSON 문자열로 바꾼다
// (axios defaults transformRequest). 'multipart/form-data'로 덮어 두면 브라우저 전송 직전에 axios가 이 헤더를 지우고
// 브라우저가 boundary를 붙여 정한다(resolveConfig) - 프로필 사진·약 사진 업로드와 같은 방식. boundary를 직접 쓰지 말 것.
// 음성·결과는 저장하거나 로그로 남기지 않는다.
export async function transcribeChatAudio(audio: Blob, signal?: AbortSignal): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audio, 'voice.wav');

  const response = await apiClient.post<CommonResponse<{ text?: unknown }>>(
    `${resolveChatBasePath(getAuthRole())}/stt`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: CHAT_STT_TIMEOUT_MS, signal },
  );
  const data = getResponseData<{ text?: unknown }>(response);
  return typeof data?.text === 'string' ? data.text.trim() : '';
}
