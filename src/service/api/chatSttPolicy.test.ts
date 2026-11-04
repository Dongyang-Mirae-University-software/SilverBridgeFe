import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { ChatRoleUnknownError } from './chatPolicy';
import { STT_MESSAGES, getSttErrorMessage } from './chatSttPolicy';

function axiosError(status: number, code?: string, headers: Record<string, string> = {}) {
  return new AxiosError('x', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    data: code ? { code } : {},
    headers: new AxiosHeaders(headers),
    config: { headers: new AxiosHeaders() },
  });
}

describe('getSttErrorMessage', () => {
  it('오류 code별 안내 문구(서버 ErrorCode와 같은 뜻)', () => {
    expect(getSttErrorMessage(axiosError(400, 'CHAT_STT_AUDIO_INVALID'))).toBe(STT_MESSAGES.invalid);
    expect(getSttErrorMessage(axiosError(400, 'FILE_REQUIRED'))).toBe(STT_MESSAGES.invalid);
    expect(getSttErrorMessage(axiosError(415, 'UNSUPPORTED_MEDIA_TYPE'))).toBe(STT_MESSAGES.invalid);
    expect(getSttErrorMessage(axiosError(415))).toBe(STT_MESSAGES.invalid);
    expect(STT_MESSAGES.invalid).toContain('다시 말씀해 주세요');
    expect(getSttErrorMessage(axiosError(413, 'CHAT_STT_AUDIO_TOO_LARGE'))).toBe(STT_MESSAGES.tooLarge);
    expect(getSttErrorMessage(axiosError(503, 'CHAT_STT_BUSY'))).toBe('잠시 후 다시 눌러 주세요.');
    expect(getSttErrorMessage(axiosError(503, 'CHAT_STT_UNAVAILABLE'))).toBe(STT_MESSAGES.unavailable);
    expect(getSttErrorMessage(axiosError(503, 'CHAT_STT_DISABLED'))).toBe(STT_MESSAGES.disabled);
    expect(STT_MESSAGES.disabled).toContain('글로 입력해 주세요');
    expect(STT_MESSAGES.empty).toBe('잘 못 들었어요. 다시 말씀해 주세요.');
  });

  it('429는 Retry-After 초를 안내한다(없거나 이상하면 잠시 후)', () => {
    expect(getSttErrorMessage(axiosError(429, 'TOO_MANY_REQUESTS', { 'retry-after': '12' }))).toBe(
      '요청이 많아요. 12초 후 다시 눌러 주세요.',
    );
    expect(getSttErrorMessage(axiosError(429, 'TOO_MANY_REQUESTS'))).toBe('요청이 많아요. 잠시 후 다시 눌러 주세요.');
    expect(getSttErrorMessage(axiosError(429, undefined, { 'retry-after': 'abc' }))).toBe(
      '요청이 많아요. 잠시 후 다시 눌러 주세요.',
    );
  });

  it('code 없는 상태·타임아웃·알 수 없는 오류', () => {
    expect(getSttErrorMessage(axiosError(413))).toBe(STT_MESSAGES.tooLarge);
    expect(getSttErrorMessage(axiosError(503))).toBe(STT_MESSAGES.unavailable);
    expect(getSttErrorMessage(axiosError(504))).toBe(STT_MESSAGES.unavailable);
    expect(getSttErrorMessage(new AxiosError('timeout', 'ECONNABORTED'))).toBe(STT_MESSAGES.unavailable);
    expect(getSttErrorMessage(axiosError(500))).toBe(STT_MESSAGES.generic);
    expect(getSttErrorMessage(new Error('x'))).toBe(STT_MESSAGES.generic);
    expect(getSttErrorMessage(new ChatRoleUnknownError())).toContain('로그인 정보');
  });
});
