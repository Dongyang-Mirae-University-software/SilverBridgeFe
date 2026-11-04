import { describe, expect, it } from 'vitest';

import { formatLastDialogue } from './companion';

const NOW = new Date('2026-11-04T15:20:00+09:00').getTime();

describe('마지막 대화 표시', () => {
  it.each([
    [null, '대화 기록 없음'],
    ['2026-11-04T09:05:00+09:00', '마지막 대화 오늘 오전 9:05'],
    ['2026-11-03T19:10:00+09:00', '마지막 대화 어제 오후 7:10'],
    // KST 자정 직전은 UTC로는 같은 날이어도 어제다
    ['2026-11-03T23:50:00+09:00', '마지막 대화 어제 오후 11:50'],
    ['2026-11-02T09:40:00+09:00', '마지막 대화 2일 전'],
    ['2026-11-01T09:40:00+09:00', '마지막 대화 3일 전'],
  ])('%s → %s', (value, label) => {
    expect(formatLastDialogue(value, NOW)).toBe(label);
  });
});
