import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { ChatRoleUnknownError, getChatErrorMessage, resolveChatBasePath } from './chatPolicy';

function axiosError(status: number, code?: string, headers: Record<string, string> = {}) {
  return new AxiosError('x', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    data: code ? { code } : {},
    headers: new AxiosHeaders(headers),
    config: { headers: new AxiosHeaders() },
  });
}

describe('resolveChatBasePath', () => {
  it('역할별 경로를 돌려준다', () => {
    expect(resolveChatBasePath('WARD')).toBe('/ward/chat');
    expect(resolveChatBasePath('GUARDIAN')).toBe('/guardian/chat');
  });

  it('역할을 모르면 보호자 경로로 가지 않고 던진다', () => {
    for (const role of [null, undefined, '', 'ADMIN']) {
      expect(() => resolveChatBasePath(role)).toThrow(ChatRoleUnknownError);
    }
  });
});

describe('getChatErrorMessage', () => {
  it('429는 잠시 후 다시 시도하라고 안내한다', () => {
    expect(getChatErrorMessage(axiosError(429, 'CHAT_LIMIT_EXCEEDED'))).toContain('잠시 후 다시 시도');
    expect(getChatErrorMessage(axiosError(429))).toContain('잠시 후 다시 시도');
    expect(getChatErrorMessage(axiosError(429, 'TOO_MANY_REQUESTS', { 'retry-after': '30' }))).toContain('30초');
  });

  it('503은 이용 불가 문구로 매핑한다 (code 유무 모두)', () => {
    const expected = '지금은 상담을 이용할 수 없어요. 잠시 후 다시 시도해 주세요.';
    expect(getChatErrorMessage(axiosError(503, 'CHAT_UNAVAILABLE'))).toBe(expected);
    expect(getChatErrorMessage(axiosError(503))).toBe(expected);
  });

  it('504와 클라이언트 타임아웃은 오래 걸림 문구다', () => {
    expect(getChatErrorMessage(axiosError(504, 'CHAT_TIMEOUT'))).toContain('오래 걸리고');
    expect(getChatErrorMessage(new AxiosError('t', 'ECONNABORTED'))).toContain('오래 걸리고');
  });

  it('역할 미확정·그 외 오류는 고정 문구이고 원문을 노출하지 않는다', () => {
    expect(getChatErrorMessage(new ChatRoleUnknownError())).toContain('로그인 정보');
    expect(getChatErrorMessage(new Error('secret detail'))).not.toContain('secret');
  });
});
