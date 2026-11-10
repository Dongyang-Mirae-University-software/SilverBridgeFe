import { isAxiosError } from 'axios';

// 안부 말벗 오류 안내 - 문구가 아니라 서버 code로 나눈다
// stay: 대화를 그대로 두고 다시 보내게 한다
// text: 음성을 못 알아들으니 글로 대답하게 바꾼다
// exit: 이 대화는 더 이어갈 수 없다 - 오늘 현황으로 돌아가 다시 받는다
export type CompanionErrorAction = 'stay' | 'text' | 'exit';

export const COMPANION_MESSAGES = {
  unavailable: '지금은 말벗과 이야기할 수 없어요. 잠시 후 다시 해 주세요.',
  timeout: '말벗 대답이 늦어요. 다시 보내 주세요.',
  generic: '보내지 못했어요. 잠시 후 다시 해 주세요.',
  frame: '사진을 보내지 못했어요. 이제 목소리만 보낼게요. 다시 말씀해 주세요.',
} as const;

const FRAME_CODES = new Set(['COMPANION_FRAME_INVALID', 'COMPANION_FRAME_TOO_LARGE', 'COMPANION_UPLOAD_TOO_LARGE']);

// 사진 때문에 거절됐을 수 있는 오류 - 화면은 이 대화에서 사진을 끈다
export function isCompanionFrameError(error: unknown) {
  return isAxiosError<{ code?: string }>(error) && FRAME_CODES.has(error.response?.data?.code ?? '');
}

const BY_CODE: Record<string, { message: string; action: CompanionErrorAction }> = {
  COMPANION_NOT_IN_WINDOW: { message: '지금은 안부 대화 시간이 아니에요.', action: 'exit' },
  COMPANION_SLOT_DONE: { message: '이 시간의 안부 대화는 이미 마쳤어요.', action: 'exit' },
  COMPANION_TURN_IN_PROGRESS: { message: '앞의 대답을 듣고 있어요. 잠시만 기다려 주세요.', action: 'stay' },
  COMPANION_SESSION_ENDED: { message: '이미 끝난 대화예요.', action: 'exit' },
  COMPANION_SESSION_LOST: { message: '대화가 끊겼어요. 다음 시간에 다시 이야기해요.', action: 'exit' },
  COMPANION_SESSION_NOT_FOUND: { message: '대화를 찾을 수 없어요.', action: 'exit' },
  COMPANION_SESSION_NOT_OWNED: { message: '본인의 안부 대화만 이어갈 수 있어요.', action: 'exit' },
  COMPANION_ANSWER_EMPTY: { message: '대답을 적어 주세요.', action: 'stay' },
  COMPANION_ANSWER_TOO_LONG: { message: '대답은 500자까지 보낼 수 있어요.', action: 'stay' },
  COMPANION_AUDIO_INVALID: { message: '목소리를 알아듣지 못했어요. 다시 말씀하시거나 글로 대답해 주세요.', action: 'stay' },
  COMPANION_AUDIO_TOO_LARGE: { message: '말씀이 너무 길어요. 조금 짧게 다시 말씀해 주세요.', action: 'stay' },
  // 사진을 받지 못하면 화면이 사진을 끄고 목소리만 다시 보내게 한다(isCompanionFrameError)
  COMPANION_FRAME_INVALID: { message: COMPANION_MESSAGES.frame, action: 'stay' },
  COMPANION_FRAME_TOO_LARGE: { message: COMPANION_MESSAGES.frame, action: 'stay' },
  COMPANION_TEST_NOT_ALLOWED: { message: '테스트 계정만 쓸 수 있습니다.', action: 'stay' },
  COMPANION_UPLOAD_TOO_LARGE: { message: '말씀이 너무 길어요. 조금 짧게 다시 말씀해 주세요.', action: 'stay' },
  COMPANION_STT_UNAVAILABLE: { message: '지금은 목소리를 알아듣지 못해요. 글로 대답해 주세요.', action: 'text' },
  COMPANION_DISABLED: { message: COMPANION_MESSAGES.unavailable, action: 'stay' },
  COMPANION_UNAVAILABLE: { message: COMPANION_MESSAGES.unavailable, action: 'stay' },
  COMPANION_BUSY: { message: COMPANION_MESSAGES.unavailable, action: 'stay' },
  COMPANION_TIMEOUT: { message: COMPANION_MESSAGES.timeout, action: 'stay' },
};

export function getCompanionError(error: unknown): { message: string; action: CompanionErrorAction } {
  if (!isAxiosError<{ code?: string }>(error)) return { message: COMPANION_MESSAGES.generic, action: 'stay' };
  // 100초 안에 답이 없으면 서버 시간 초과와 같게 안내한다
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return { message: COMPANION_MESSAGES.timeout, action: 'stay' };

  const status = error.response?.status;
  const code = error.response?.data?.code;
  if (code === 'TOO_MANY_REQUESTS' || status === 429) {
    const retryAfter = Number(error.response?.headers?.['retry-after']);
    return {
      message: Number.isFinite(retryAfter) && retryAfter > 0
        ? `너무 자주 보냈어요. ${Math.ceil(retryAfter)}초 뒤에 다시 해 주세요.`
        : '너무 자주 보냈어요. 잠시 후 다시 해 주세요.',
      action: 'stay',
    };
  }
  if (code && BY_CODE[code]) return BY_CODE[code];
  if (status === 503) return { message: COMPANION_MESSAGES.unavailable, action: 'stay' };
  if (status === 504) return { message: COMPANION_MESSAGES.timeout, action: 'stay' };
  return { message: COMPANION_MESSAGES.generic, action: 'stay' };
}
