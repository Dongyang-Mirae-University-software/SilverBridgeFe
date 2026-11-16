import { describe, expect, it } from 'vitest';

import { getServerMessage } from './serverMessage';

describe('서버 안내 문구 (QA CONN-A38)', () => {
  it('응답 본문의 message를 쓰고, 없거나 비면 null', () => {
    expect(getServerMessage({ response: { data: { message: '복약 정보를 찾을 수 없습니다.' } } })).toBe('복약 정보를 찾을 수 없습니다.');
    expect(getServerMessage({ response: { data: { message: ' ' } } })).toBeNull();
    expect(getServerMessage(new Error('Network Error'))).toBeNull();
    expect(getServerMessage(null)).toBeNull();
  });
});
