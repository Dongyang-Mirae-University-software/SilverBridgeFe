import { describe, expect, it } from 'vitest';

import { PASSWORD_PATTRERN } from './pattern';

describe('비밀번호 규칙 - 서버와 같게 (QA AUTH-A03)', () => {
  it('영문·숫자·특수문자를 모두 넣은 8~64자만 통과한다', () => {
    expect(PASSWORD_PATTRERN.test('abcd123!')).toBe(true);
    expect(PASSWORD_PATTRERN.test(`a1!${'x'.repeat(61)}`)).toBe(true);
  });

  it('영문이 없거나 64자를 넘으면 막는다', () => {
    expect(PASSWORD_PATTRERN.test('12345678!')).toBe(false);
    expect(PASSWORD_PATTRERN.test(`a1!${'x'.repeat(62)}`)).toBe(false);
  });
});
