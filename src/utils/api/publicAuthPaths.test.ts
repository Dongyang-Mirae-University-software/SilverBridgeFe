import { describe, expect, it } from 'vitest';

import { isPublicAuthPath } from './publicAuthPaths';

describe('공개 인증 경로', () => {
  it('가입·계정 찾기·비밀번호 재설정은 공개 경로다', () => {
    ['/auth/signup', '/auth/signup/kakao', '/auth/signup/email/check?email=a', '/auth/find-password/email/send', '/auth/find-email', '/auth/password/reset', '/notifications/fcm-token/release']
      .forEach(path => expect(isPublicAuthPath(path)).toBe(true));
  });

  it('로그인한 사람의 경로와 이름만 비슷한 경로는 공개가 아니다', () => {
    ['/user/me', '/auth/logout', '/auth/signupx', '/auth/find-emails', undefined]
      .forEach(path => expect(isPublicAuthPath(path)).toBe(false));
  });
});
