import { describe, expect, it } from 'vitest';

import { getBirthDateError } from './birthDate';

// 2026-11-14 한국 시간 낮
const NOW = new Date('2026-11-14T03:00:00Z');

describe('가입 생년월일 검사 - 서버와 같은 규칙 (QA AUTH-A05)', () => {
  it('만 14세 이상 120세 이하의 지난 날짜는 통과한다', () => {
    expect(getBirthDateError('2012-11-14', NOW)).toBeNull();
    expect(getBirthDateError('1946-03-02', NOW)).toBeNull();
    expect(getBirthDateError('', NOW)).toBeNull();
  });

  it('미래·오늘 날짜는 막는다', () => {
    expect(getBirthDateError('2026-11-14', NOW)).toBe('오늘보다 앞선 날짜를 골라 주세요.');
    expect(getBirthDateError('2027-01-01', NOW)).toBe('오늘보다 앞선 날짜를 골라 주세요.');
  });

  it('만 14세에 하루 모자라면 막는다', () => {
    expect(getBirthDateError('2012-11-15', NOW)).toBe('만 14세 이상만 가입할 수 있어요.');
  });

  it('만 121세는 막는다', () => {
    expect(getBirthDateError('1905-11-13', NOW)).toBe('만 120세 이하만 가입할 수 있어요.');
  });

  it('없는 날짜·형식 오류는 막는다', () => {
    expect(getBirthDateError('2001-02-30', NOW)).toBe('생년월일을 다시 골라 주세요.');
    expect(getBirthDateError('2001-2-3', NOW)).toBe('생년월일을 다시 골라 주세요.');
  });
});
