import { describe, expect, it } from 'vitest';

import type { MedicationItem } from '@/service/interface/medication';
import { formatDoseAmount, getDoseStatus, isRegisteredAfterDose, toKstDateTime } from './medication';

describe('formatDoseAmount (2026-10-22 점검 M-3)', () => {
  it('BE 알림 문구와 같게 - 0.5는 "반 알", 1.5는 "1정 반", 정수는 "N정"', () => {
    expect(formatDoseAmount(0.5)).toBe('반 알');
    expect(formatDoseAmount(1)).toBe('1정');
    expect(formatDoseAmount(1.5)).toBe('1정 반');
    expect(formatDoseAmount(2)).toBe('2정');
    expect(formatDoseAmount(99)).toBe('99정');
  });
});

function med(overrides: Partial<MedicationItem> = {}): MedicationItem {
  return {
    medicationId: 1,
    name: '혈압약',
    timeSlot: 'MORNING',
    doseTime: '08:00:00',
    doseAmount: 1,
    memo: null,
    taken: false,
    takenAt: null,
    ...overrides,
  };
}

const TODAY = '2026-10-22';

describe('오늘 등록 전에 지난 복용 시각 (BE MedicationClock.registeredAfterDose와 같은 기준)', () => {
  it('오늘 복용 시각 뒤에 등록하면 "지난 약"이 아니다', () => {
    const late = med({ createdAt: '2026-10-22T14:00:00+09:00' });
    expect(isRegisteredAfterDose(late, TODAY)).toBe(true);
    expect(getDoseStatus(late, '15:00', TODAY)).toBe('beforeRegistered');
  });

  it('정각 등록·어제 등록·등록 시각 모름은 예전처럼 센다', () => {
    expect(getDoseStatus(med({ createdAt: '2026-10-22T08:00:00+09:00' }), '15:00', TODAY)).toBe('miss');
    expect(getDoseStatus(med({ createdAt: '2026-10-21T14:00:00+09:00' }), '15:00', TODAY)).toBe('miss');
    expect(getDoseStatus(med({ createdAt: null }), '15:00', TODAY)).toBe('miss');
    expect(getDoseStatus(med(), '15:00', TODAY)).toBe('miss');
    expect(getDoseStatus(med({ createdAt: 'not-a-date' }), '15:00', TODAY)).toBe('miss');
  });

  it('정각에서 조금이라도 늦으면 뺀다(BE는 초 이하까지 비교)', () => {
    expect(isRegisteredAfterDose(med({ createdAt: '2026-10-22T08:00:00.500+09:00' }), TODAY)).toBe(true);
  });

  it('UTC로 와도 KST로 비교한다(10/21 23:30 UTC = 10/22 08:30 KST)', () => {
    expect(toKstDateTime('2026-10-21T23:30:00Z')).toEqual({ date: '2026-10-22', time: '08:30:00.000' });
    expect(isRegisteredAfterDose(med({ createdAt: '2026-10-21T23:30:00Z' }), TODAY)).toBe(true);
    // 10/21 22:30 UTC = 10/22 07:30 KST - 복용 시각 전 등록이라 센다
    expect(isRegisteredAfterDose(med({ createdAt: '2026-10-21T22:30:00Z' }), TODAY)).toBe(false);
  });

  it('체크한 약은 등록 시각과 무관하게 "드셨어요", 복용 시각 전이면 "드실 시간 전"', () => {
    expect(getDoseStatus(med({ taken: true, createdAt: '2026-10-22T14:00:00+09:00' }), '15:00', TODAY)).toBe('done');
    expect(getDoseStatus(med({ doseTime: '19:00:00', createdAt: '2026-10-22T14:00:00+09:00' }), '15:00', TODAY)).toBe(
      'later',
    );
    // 복용 시각 정각은 지난 것으로 본다(기존 동작)
    expect(getDoseStatus(med(), '08:00', TODAY)).toBe('miss');
  });
});
