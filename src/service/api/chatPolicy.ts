import axios from 'axios';

export type ChatRole = 'WARD' | 'GUARDIAN';

// 역할을 모르면(로딩 중·로그아웃) 챗 API를 부르지 않는다. 보호자 경로를 기본값으로 쓰지 않는다
export class ChatRoleUnknownError extends Error {
  constructor() {
    super('chat role is not determined');
    this.name = 'ChatRoleUnknownError';
  }
}

// 역할 → 경로 매핑은 이 한 곳에서만 한다 (서로 호출 불가 — 403). userId는 토큰으로만 식별하므로 요청에 넣지 않는다
export function resolveChatBasePath(role: string | null | undefined): string {
  if (role === 'WARD') return '/ward/chat';
  if (role === 'GUARDIAN') return '/guardian/chat';
  throw new ChatRoleUnknownError();
}

const GENERIC = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
const BUSY = '이전 상담의 답변을 기다리고 있어요. 잠시 후 다시 시도해 주세요.';
const TIMEOUT = '답변이 오래 걸리고 있어요. 다시 시도해 주세요.';
const UNAVAILABLE = '지금은 상담을 이용할 수 없어요. 잠시 후 다시 시도해 주세요.';

export function getChatErrorMessage(error: unknown): string {
  if (error instanceof ChatRoleUnknownError) return '로그인 정보를 확인하고 있어요. 잠시 후 다시 시도해 주세요.';
  if (!axios.isAxiosError<{ code?: string }>(error)) return GENERIC;

  if (error.code === 'ECONNABORTED') return TIMEOUT;

  const code = error.response?.data?.code;
  const status = error.response?.status;

  if (code === 'TOO_MANY_REQUESTS') {
    const retryAfter = error.response?.headers?.['retry-after'];
    return retryAfter ? `요청이 많아요. ${retryAfter}초 후 다시 시도해 주세요.` : '요청이 많아요. 잠시 후 다시 시도해 주세요.';
  }
  if (code === 'CHAT_LIMIT_EXCEEDED') return BUSY;
  if (code === 'CHAT_TIMEOUT') return TIMEOUT;
  if (code === 'CHAT_UNAVAILABLE') return UNAVAILABLE;
  if (code === 'CHAT_INVALID_REQUEST') return '입력 내용을 확인한 뒤 다시 보내주세요.';
  if (code === 'CHAT_LOG_NOT_FOUND') return '상담 기록을 찾을 수 없습니다.';

  // 오류 code 없이 상태만 오는 경우(프록시 등)
  if (status === 429) return BUSY;
  if (status === 503) return UNAVAILABLE;
  if (status === 504) return TIMEOUT;

  return GENERIC;
}
