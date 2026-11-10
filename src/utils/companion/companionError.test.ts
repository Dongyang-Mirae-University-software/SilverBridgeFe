import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { COMPANION_MESSAGES, getCompanionError, isCompanionFrameError } from './companionError';

function axiosError(status: number, code?: string, headers: Record<string, string> = {}) {
  return new AxiosError('x', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    headers,
    config: { headers: new AxiosHeaders() },
    data: { success: false, code },
  });
}

describe('안부 말벗 오류 안내', () => {
  it.each([
    [409, 'COMPANION_NOT_IN_WINDOW', 'exit'],
    [409, 'COMPANION_SLOT_DONE', 'exit'],
    [409, 'COMPANION_SESSION_ENDED', 'exit'],
    [409, 'COMPANION_SESSION_LOST', 'exit'],
    [404, 'COMPANION_SESSION_NOT_FOUND', 'exit'],
    [403, 'COMPANION_SESSION_NOT_OWNED', 'exit'],
    [409, 'COMPANION_TURN_IN_PROGRESS', 'stay'],
    [400, 'COMPANION_ANSWER_TOO_LONG', 'stay'],
    [503, 'COMPANION_STT_UNAVAILABLE', 'text'],
  ])('%i %s → %s', (status, code, action) => {
    expect(getCompanionError(axiosError(status, code)).action).toBe(action);
  });

  it('말벗이 꺼졌거나 바쁘면(503) 잠시 후 다시 하라고 안내한다 - code가 없어도 같다', () => {
    expect(getCompanionError(axiosError(503, 'COMPANION_DISABLED')).message).toBe(COMPANION_MESSAGES.unavailable);
    expect(getCompanionError(axiosError(503, 'COMPANION_BUSY')).message).toBe(COMPANION_MESSAGES.unavailable);
    expect(getCompanionError(axiosError(503)).message).toBe(COMPANION_MESSAGES.unavailable);
  });

  it('서버 시간 초과(504)와 화면 쪽 시간 초과는 다시 보내라고 안내한다', () => {
    expect(getCompanionError(axiosError(504, 'COMPANION_TIMEOUT')).message).toBe(COMPANION_MESSAGES.timeout);
    expect(getCompanionError(new AxiosError('timeout', 'ECONNABORTED')).message).toBe(COMPANION_MESSAGES.timeout);
  });

  it('429는 Retry-After 초를 알려 준다(없으면 잠시 후)', () => {
    expect(getCompanionError(axiosError(429, 'TOO_MANY_REQUESTS', { 'retry-after': '12' })).message).toBe(
      '너무 자주 보냈어요. 12초 뒤에 다시 해 주세요.',
    );
    expect(getCompanionError(axiosError(429)).message).toBe('너무 자주 보냈어요. 잠시 후 다시 해 주세요.');
  });

  it('테스트 계정이 아니면(403 COMPANION_TEST_NOT_ALLOWED) 그대로 알린다', () => {
    expect(getCompanionError(axiosError(403, 'COMPANION_TEST_NOT_ALLOWED'))).toEqual({ message: '테스트 계정만 쓸 수 있습니다.', action: 'stay' });
  });

  it('사진 때문에 거절된 오류를 가려낸다', () => {
    expect(isCompanionFrameError(axiosError(400, 'COMPANION_FRAME_INVALID'))).toBe(true);
    expect(isCompanionFrameError(axiosError(400, 'COMPANION_FRAME_TOO_LARGE'))).toBe(true);
    expect(isCompanionFrameError(axiosError(413, 'COMPANION_UPLOAD_TOO_LARGE'))).toBe(true);
    expect(isCompanionFrameError(axiosError(400, 'COMPANION_AUDIO_INVALID'))).toBe(false);
    expect(getCompanionError(axiosError(400, 'COMPANION_FRAME_INVALID')).message).toBe(COMPANION_MESSAGES.frame);
  });

  it('알 수 없는 오류는 대화를 그대로 두고 다시 보내게 한다', () => {
    expect(getCompanionError(new Error('x'))).toEqual({ message: COMPANION_MESSAGES.generic, action: 'stay' });
  });
});
