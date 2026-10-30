import { describe, expect, it } from 'vitest';

import { getLoginErrorMessage } from '@/utils/auth/loginError';

function errorWith(status: number, message?: string) {
  return { response: { status, data: message === undefined ? {} : { message } }, message: '요청이 너무 많아요.' };
}

describe('getLoginErrorMessage', () => {
  it('429 - 잠금 시간은 서버 설정을 따르므로 서버 문구를 그대로 보여준다', () => {
    expect(getLoginErrorMessage(errorWith(429, '비밀번호를 5회 이상 틀렸습니다. 10분 후 다시 시도해주세요.'))).toBe(
      '비밀번호를 5회 이상 틀렸습니다. 10분 후 다시 시도해주세요.',
    );
  });

  it('429 - 서버 문구가 없으면 10분 기본 문구(공용 오류 문구가 아님)', () => {
    expect(getLoginErrorMessage(errorWith(429))).toBe('비밀번호를 5회 이상 틀려 10분 동안 로그인이 제한됩니다.');
  });

  it('401 - 기존 고정 문구는 그대로', () => {
    expect(getLoginErrorMessage(errorWith(401, '서버 문구'))).toBe('이메일 또는 비밀번호가 올바르지 않습니다.');
  });
});
