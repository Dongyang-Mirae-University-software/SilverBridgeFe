import axios from 'axios';

import { ChatRoleUnknownError } from './chatPolicy';

// 음성 입력(POST .../chat/stt) 안내. 문구는 서버 ErrorCode와 맞춘다
export const STT_MESSAGES = {
  permission: '마이크 권한을 허용해 주세요.',
  empty: '잘 못 들었어요. 다시 말씀해 주세요.',
  invalid: '음성을 읽을 수 없어요. 다시 말씀해 주세요.',
  tooLarge: '음성은 30초, 10MB까지 보낼 수 있어요.',
  busy: '잠시 후 다시 눌러 주세요.',
  unavailable: '지금은 음성을 알아듣지 못해요. 글로 입력해 주세요.',
  disabled: '지금은 음성 입력을 쓸 수 없어요. 글로 입력해 주세요.',
  generic: '음성을 보내지 못했어요. 잠시 후 다시 눌러 주세요.',
} as const;

export function getSttErrorMessage(error: unknown): string {
  if (error instanceof ChatRoleUnknownError) return '로그인 정보를 확인하고 있어요. 잠시 후 다시 시도해 주세요.';
  if (!axios.isAxiosError<{ code?: string }>(error)) return STT_MESSAGES.generic;

  // 서버는 최대 30초 기다린다 - 35초 안에 답이 없으면 받아쓰기를 못 하는 상황으로 안내한다
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return STT_MESSAGES.unavailable;

  const code = error.response?.data?.code;
  const status = error.response?.status;

  if (code === 'TOO_MANY_REQUESTS' || status === 429) {
    const retryAfter = Number(error.response?.headers?.['retry-after']);
    return Number.isFinite(retryAfter) && retryAfter > 0
      ? `요청이 많아요. ${Math.ceil(retryAfter)}초 후 다시 눌러 주세요.`
      : '요청이 많아요. 잠시 후 다시 눌러 주세요.';
  }
  // 깨진 multipart(400 FILE_REQUIRED)·multipart 아님(415 UNSUPPORTED_MEDIA_TYPE)도 다시 말해 달라고 안내한다
  if (
    code === 'CHAT_STT_AUDIO_INVALID' ||
    code === 'FILE_REQUIRED' ||
    code === 'UNSUPPORTED_MEDIA_TYPE' ||
    status === 415
  ) {
    return STT_MESSAGES.invalid;
  }
  if (code === 'CHAT_STT_AUDIO_TOO_LARGE' || status === 413) return STT_MESSAGES.tooLarge;
  if (code === 'CHAT_STT_BUSY') return STT_MESSAGES.busy;
  if (code === 'CHAT_STT_DISABLED') return STT_MESSAGES.disabled;
  if (code === 'CHAT_STT_UNAVAILABLE') return STT_MESSAGES.unavailable;
  if (status === 400) return STT_MESSAGES.invalid;
  if (status === 503 || status === 504) return STT_MESSAGES.unavailable;

  return STT_MESSAGES.generic;
}
