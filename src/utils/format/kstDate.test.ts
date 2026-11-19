import { describe, expect, it } from 'vitest';

import { formatKstDate, formatKstDateTime } from './kstDate';

describe('관리자 날짜 표기 (한국 시간)', () => {
  it('날짜와 시각을 YYYY-MM-DD HH:mm으로 쓴다', () => {
    expect(formatKstDateTime('2026-11-10T14:10:00Z')).toBe('2026-11-10 23:10');
    expect(formatKstDate('2026-11-10T14:10:00Z')).toBe('2026-11-10');
  });

  it('한 자리 월·일·시는 0을 채운다', () => {
    expect(formatKstDateTime('2026-03-04T23:05:00+09:00')).toBe('2026-03-04 23:05');
    expect(formatKstDateTime('2026-03-04T01:02:00+09:00')).toBe('2026-03-04 01:02');
  });

  it('자정은 24가 아니라 00시이고, UTC 15시는 한국 날짜로 다음 날이다', () => {
    expect(formatKstDateTime('2026-11-09T15:00:00Z')).toBe('2026-11-10 00:00');
    expect(formatKstDate('2026-12-31T15:00:00Z')).toBe('2027-01-01');
  });

  it('시간대 없는 서버 시각도 그대로 읽는다', () => {
    expect(formatKstDate('2026-11-02')).toMatch(/^2026-11-0[12]$/);
  });

  it('값이 없거나 잘못되면 -', () => {
    expect(formatKstDate(null)).toBe('-');
    expect(formatKstDateTime(undefined)).toBe('-');
    expect(formatKstDateTime('')).toBe('-');
    expect(formatKstDateTime('not-a-date')).toBe('-');
  });
});
