import { describe, expect, it } from 'vitest';
import type { IWardCompanionToday } from '@/service/interface/ward/companion';
import { openCompanionSlot } from './companionOpen';

type Status = IWardCompanionToday['slots'][number]['status'];

function today(currentSlot: string | null, noonStatus: Status): IWardCompanionToday {
  return {
    date: '2026-11-11',
    currentSlot,
    slots: [
      { slot: '09:00', status: 'DONE', mood: null },
      { slot: '12:00', status: noonStatus, mood: null },
      { slot: '15:00', status: 'UPCOMING', mood: null },
    ],
  };
}

describe('openCompanionSlot', () => {
  it.each([
    ['AVAILABLE', '12:00'],
    ['IN_PROGRESS', '12:00'],
    ['DONE', null],
    ['MISSED', null],
  ] as [Status, string | null][])('지금 시간대가 %s 이면 %s', (status, expected) => {
    expect(openCompanionSlot(today('12:00', status))).toBe(expected);
  });

  it('창 밖(currentSlot 없음)·현황 없음은 null', () => {
    expect(openCompanionSlot(today(null, 'AVAILABLE'))).toBeNull();
    expect(openCompanionSlot(undefined)).toBeNull();
    expect(openCompanionSlot(null)).toBeNull();
  });

  it('목록에 없는 currentSlot 은 null', () => {
    expect(openCompanionSlot(today('18:00', 'AVAILABLE'))).toBeNull();
  });
});
