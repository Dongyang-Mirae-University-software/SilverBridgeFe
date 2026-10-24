import { describe, expect, it } from 'vitest';

import type { MedicationItem } from '@/service/interface/medication';
import {
  formatDoseAmount,
  getDoseStatus,
  getTodayHeadline,
  getTimeGroupStatusLabel,
  groupMedicationsByTime,
  isRegisteredAfterDose,
  summarizeMedicationNames,
  toKstDateTime,
} from './medication';

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

  it('정각에서 조금이라도 늦으면 뺀다(밀리초까지 맞춘다 - BE는 나노초까지라 그 아래 차이는 무시)', () => {
    expect(isRegisteredAfterDose(med({ createdAt: '2026-10-22T08:00:00.500+09:00' }), TODAY)).toBe(true);
  });

  it('자정 경계: 어제 23:59 등록은 오늘 센다, 오늘 00:00 직후 등록은 00:00 약을 뺀다 (점검 L-3)', () => {
    const midnight = med({ doseTime: '00:00:00' });
    expect(isRegisteredAfterDose({ ...midnight, createdAt: '2026-10-21T23:59:59+09:00' }, TODAY)).toBe(false);
    expect(isRegisteredAfterDose({ ...midnight, createdAt: '2026-10-22T00:00:01+09:00' }, TODAY)).toBe(true);
    // 23:30 약을 23:59에 등록 - 그날은 뺀다
    expect(isRegisteredAfterDose(med({ doseTime: '23:30:00', createdAt: '2026-10-22T23:59:00+09:00' }), TODAY)).toBe(true);
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

describe('시간대 묶음 - 약 6개 × 하루 3번은 "18번"이 아니라 "3번" (2026-10-23)', () => {
  let id = 100;
  const item = (overrides: Partial<MedicationItem>) => ({ ...med(overrides), medicationId: ++id });

  it('같은 시간대·시각끼리 묶고, 시각 순서를 지킨다', () => {
    const meds = ['08:00:00', '12:00:00', '19:00:00'].flatMap((doseTime, slot) =>
      ['코싹열정', '알마겔정'].map(name =>
        item({ name, doseTime, timeSlot: (['MORNING', 'LUNCH', 'DINNER'] as const)[slot] }),
      ),
    );
    const groups = groupMedicationsByTime(meds, '13:00', TODAY);
    expect(groups.map(g => [g.label, g.medications.length])).toEqual([
      ['아침', 2],
      ['점심', 2],
      ['저녁', 2],
    ]);
    expect(groups.map(g => g.status)).toEqual(['miss', 'miss', 'later']);
  });

  it('같은 시간대에 시각이 다르면 따로 묶고 이름에 시각을 붙인다', () => {
    const groups = groupMedicationsByTime(
      [item({ timeSlot: 'DINNER', doseTime: '19:00:00' }), item({ timeSlot: 'DINNER', doseTime: '20:00:00' })],
      '21:00',
      TODAY,
    );
    expect(groups.map(g => g.label)).toEqual(['저녁 19:00', '저녁 20:00']);
  });

  it('모두 체크하면 "다 드셨어요", 일부만이면 "N개 중 M개", 하나도 안 했으면 "아직 체크 전"', () => {
    const at8 = { doseTime: '08:00:00' };
    const [done] = groupMedicationsByTime([item({ ...at8, taken: true }), item({ ...at8, taken: true })], '09:00', TODAY);
    const [partial] = groupMedicationsByTime([item({ ...at8, taken: true }), item(at8), item(at8)], '09:00', TODAY);
    const [none] = groupMedicationsByTime([item(at8)], '09:00', TODAY);
    const [later] = groupMedicationsByTime([item(at8)], '07:00', TODAY);
    expect([done, partial, none, later].map(getTimeGroupStatusLabel)).toEqual([
      '다 드셨어요',
      '3개 중 1개 드셨어요',
      '아직 체크 전이에요',
      '드실 시간 전',
    ]);
  });

  it('오늘 등록 전이었던 약은 묶음 판정에서 뺀다 - 나머지를 다 드셨으면 "다 드셨어요"', () => {
    const at8 = { doseTime: '08:00:00' };
    const lateRegistered = { ...at8, createdAt: `${TODAY}T10:00:00+09:00` };
    const [mixed] = groupMedicationsByTime([item({ ...at8, taken: true }), item(lateRegistered)], '11:00', TODAY);
    expect(mixed).toMatchObject({ status: 'done', takenCount: 1, countedCount: 1 });
    const [onlyLate] = groupMedicationsByTime([item(lateRegistered)], '11:00', TODAY);
    expect(getTimeGroupStatusLabel(onlyLate)).toBe('오늘은 등록 전이었어요');
  });

  it('이름 요약: 두 개까지 보이고 나머지는 "외 N개"', () => {
    expect(summarizeMedicationNames([item({ name: '가' }), item({ name: '나' }), item({ name: '다' }), item({ name: '라' })])).toBe(
      '가, 나 외 2개',
    );
    expect(summarizeMedicationNames([item({ name: '가' })])).toBe('가');
  });
});

describe('카드 맨 위 한 문장 - "N번 중"이 아니라 시간대로 (2026-10-24)', () => {
  let id = 500;
  const at = (timeSlot: MedicationItem['timeSlot'], doseTime: string, taken = false) =>
    ({ ...med({ timeSlot, doseTime, taken }), medicationId: ++id });
  const head = (meds: MedicationItem[], now: string) => getTodayHeadline(groupMedicationsByTime(meds, now, TODAY));

  it('지난 마지막 시간대를 다 드셨으면 "아침 약을 다 드셨어요"', () => {
    expect(head([at('MORNING', '08:00:00', true), at('LUNCH', '12:00:00')], '09:00')).toEqual({
      text: '아침 약을 다 드셨어요',
      tone: 'done',
      sub: null,
    });
  });

  it('지난 마지막 시간대가 남았으면 "아직 체크되지 않았어요"(단정하지 않는다), 앞 시간대가 남았으면 아래 줄로', () => {
    expect(head([at('MORNING', '08:00:00'), at('LUNCH', '12:00:00', true)], '13:00')).toEqual({
      text: '점심 약을 다 드셨어요',
      tone: 'done',
      sub: '아침 약도 아직 체크되지 않았어요',
    });
    const h = head([at('MORNING', '08:00:00', true), at('LUNCH', '12:00:00')], '13:00')!;
    expect(h.text).toBe('점심 약이 아직 체크되지 않았어요');
    expect(h.text).not.toContain('안 드셨');
  });

  it('하루 약을 모두 드셨으면 "오늘 약을 모두 드셨어요", 아직 시간 전이면 첫 시간대 안내, 셀 약이 없으면 null', () => {
    expect(head([at('MORNING', '08:00:00', true), at('DINNER', '19:00:00', true)], '20:00')!.text).toBe(
      '오늘 약을 모두 드셨어요',
    );
    expect(head([at('MORNING', '08:00:00'), at('DINNER', '19:00:00')], '07:00')!.text).toBe('아침 약은 08:00에 드세요');
    expect(head([], '07:00')).toBeNull();
  });
});
