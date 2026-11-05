import { describe, expect, it } from 'vitest';

import { formatNotificationTime } from './notificationTime';

const NOW = new Date('2026-11-05T15:30:00+09:00');

describe('알림함 시각', () => {
  it.each([
    ['2026-11-05T15:29:40+09:00', '방금'],
    ['2026-11-05T15:05:00+09:00', '25분 전'],
    ['2026-11-05T09:02:00+09:00', '오전 9:02'],
    ['2026-11-04T23:10:00+09:00', '어제 오후 11:10'],
    ['2026-11-01T14:00:00+09:00', '11월 1일 오후 2:00'],
    // UTC로 와도 KST 날짜로 센다(11/4 20:00 UTC = 11/5 05:00 KST)
    ['2026-11-04T20:00:00Z', '오전 5:00'],
  ])('%s → %s', (value, label) => {
    expect(formatNotificationTime(value, NOW)).toBe(label);
  });

  it('형식이 잘못되면 빈 글자', () => {
    expect(formatNotificationTime('x', NOW)).toBe('');
  });
});
