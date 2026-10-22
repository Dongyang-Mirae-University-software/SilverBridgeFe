import { describe, expect, it } from 'vitest';

import { MedicationOcrDrug, MedicationOcrResponse } from '@/service/interface/medication';
import {
  canProceedDrugs,
  createEmptyDrug,
  decreaseDose,
  defaultSlotsForGroup,
  DraftDrug,
  findDuplicateDrugKeys,
  formatDoseLabel,
  getGroupTitle,
  getTimesMismatchHint,
  groupDrugsByTimesPerDay,
  groupToBatchRequest,
  increaseDose,
  MAX_DRUGS,
  normalizeDoseAmount,
  normalizeDrugName,
  ocrResultToDraft,
  SINGLE_GROUP_KEY,
  toggleSlot,
} from './medicationDraft';

function drug(overrides: Partial<MedicationOcrDrug> = {}): MedicationOcrDrug {
  return {
    name: '타이레놀정',
    perDose: 1,
    timesPerDay: null,
    days: null,
    slots: [],
    timing: null,
    confidence: 'high',
    ...overrides,
  };
}

function ocr(drugs: MedicationOcrDrug[], readable = true): MedicationOcrResponse {
  return { readable, drugs };
}

function draftDrug(overrides: Partial<DraftDrug> = {}): DraftDrug {
  return { ...createEmptyDrug(), name: '약', ...overrides };
}

describe('ocrResultToDraft', () => {
  it('읽지 못했거나 약이 없으면 null', () => {
    expect(ocrResultToDraft(null)).toBeNull();
    expect(ocrResultToDraft(ocr([], false))).toBeNull();
    expect(ocrResultToDraft(ocr([]))).toBeNull();
    expect(ocrResultToDraft(ocr([drug({ name: '  ' })]))).toBeNull();
  });

  it('반 알은 0.5, 복용량을 못 읽으면 1알', () => {
    const { drugs } = ocrResultToDraft(ocr([drug({ perDose: 0.5 }), drug({ name: '아스피린', perDose: null })]))!;
    expect(drugs.map(d => d.doseAmount)).toEqual([0.5, 1]);
  });

  it('약마다 하루 횟수·시간대를 그대로 갖고 있는다(0·소수는 모름)', () => {
    const { drugs } = ocrResultToDraft(
      ocr([
        drug({ timesPerDay: 3, slots: ['DINNER', 'MORNING'] }),
        drug({ name: '아스피린', timesPerDay: 0 }),
        drug({ name: '코싹엘정', timesPerDay: 1.5 }),
      ]),
    )!;
    expect(drugs.map(d => d.timesPerDay)).toEqual([3, null, null]);
    expect(drugs[0].slots).toEqual(['MORNING', 'DINNER']);
  });

  it('확신 낮은 약 표시', () => {
    expect(ocrResultToDraft(ocr([drug({ confidence: 'low' })]))!.drugs[0].lowConfidence).toBe(true);
  });

  it(`약이 ${MAX_DRUGS}개를 넘으면 앞의 ${MAX_DRUGS}개만 가져오고 알린다`, () => {
    const many = Array.from({ length: MAX_DRUGS + 3 }, (_, i) => drug({ name: `약${i}` }));
    const result = ocrResultToDraft(ocr(many))!;
    expect(result.drugs).toHaveLength(MAX_DRUGS);
    expect(result.drugs[0].name).toBe('약0');
    expect(result.truncated).toBe(true);
    expect(ocrResultToDraft(ocr(many.slice(0, MAX_DRUGS)))!.truncated).toBe(false);
  });

  it('긴 이름은 100자로 자른다', () => {
    expect(ocrResultToDraft(ocr([drug({ name: '가'.repeat(150) })]))!.drugs[0].name).toHaveLength(100);
  });
});

describe('하루 횟수별 줄 나누기 (2026-10-22 실제 봉투: 하루 2번 약이 3번으로 등록됨)', () => {
  it('모두 같거나 모르면 한 줄', () => {
    const same = groupDrugsByTimesPerDay([draftDrug({ timesPerDay: 3 }), draftDrug({ timesPerDay: 3 })]);
    expect(same).toHaveLength(1);
    expect(same[0]).toMatchObject({ key: SINGLE_GROUP_KEY, timesPerDay: 3 });

    const unknown = groupDrugsByTimesPerDay([draftDrug(), draftDrug()]);
    expect(unknown).toHaveLength(1);
    expect(unknown[0].timesPerDay).toBeNull();

    // 아는 횟수가 하나뿐이면 모르는 약이 섞여도 한 줄
    expect(groupDrugsByTimesPerDay([draftDrug({ timesPerDay: 3 }), draftDrug()])).toHaveLength(1);
  });

  it('서로 다르면 횟수별로 나누고(많은 횟수 먼저) 모르는 약은 따로 둔다', () => {
    const drugs = [
      draftDrug({ name: '신일이부프로펜정', timesPerDay: 3 }),
      draftDrug({ name: '코싹엘정', timesPerDay: 2 }),
      draftDrug({ name: '뮤테란캡슐', timesPerDay: 3 }),
      draftDrug({ name: '직접 쓴 약' }),
    ];
    const groups = groupDrugsByTimesPerDay(drugs);
    expect(groups.map(g => [g.timesPerDay, g.drugs.map(d => d.name)])).toEqual([
      [3, ['신일이부프로펜정', '뮤테란캡슐']],
      [2, ['코싹엘정']],
      [null, ['직접 쓴 약']],
    ]);
    expect(groups.map(getGroupTitle)).toEqual([
      '하루 3번 · 신일이부프로펜정 외 1개',
      '하루 2번 · 코싹엘정',
      '하루 횟수 모름 · 직접 쓴 약',
    ]);
  });
});

describe('기본 선택', () => {
  const pick = (drugs: DraftDrug[]) => {
    const groups = groupDrugsByTimesPerDay(drugs);
    return groups.map(group => defaultSlotsForGroup(group, drugs));
  };

  it('봉투 시간대 표시 개수가 하루 횟수와 같은 줄에만 표시를 쓴다', () => {
    const slots = ['MORNING', 'LUNCH', 'DINNER'] as const;
    expect(
      pick([
        draftDrug({ timesPerDay: 3, slots: [...slots] }),
        draftDrug({ timesPerDay: 2, slots: [...slots] }),
      ]),
    ).toEqual([
      ['MORNING', 'LUNCH', 'DINNER'],
      ['MORNING', 'DINNER'],
    ]);
  });

  it('줄의 약에 표시가 없으면 봉투 전체의 표시를 본다', () => {
    expect(
      pick([draftDrug({ timesPerDay: 2, slots: ['MORNING', 'BEDTIME'] }), draftDrug({ timesPerDay: 1 })]),
    ).toEqual([['MORNING', 'BEDTIME'], ['MORNING']]);
  });

  it('표시가 없으면 하루 횟수로, 정보가 없으면 아침', () => {
    const one = (timesPerDay: number | null) => pick([draftDrug({ timesPerDay })])[0];
    expect(one(1)).toEqual(['MORNING']);
    expect(one(2)).toEqual(['MORNING', 'DINNER']);
    expect(one(3)).toEqual(['MORNING', 'LUNCH', 'DINNER']);
    expect(one(4)).toEqual(['MORNING', 'LUNCH', 'DINNER', 'BEDTIME']);
    expect(one(6)).toEqual(['MORNING', 'LUNCH', 'DINNER', 'BEDTIME']);
    expect(one(null)).toEqual(['MORNING']);
  });

  it('하루 횟수를 모르면 봉투 표시를 그대로 쓴다', () => {
    expect(pick([draftDrug({ slots: ['LUNCH'] })])).toEqual([['LUNCH']]);
  });
});

describe('2/2 칩', () => {
  it('고른 칸 수가 하루 횟수와 다르면 안내(모르면 안내 없음)', () => {
    const [group] = groupDrugsByTimesPerDay([draftDrug({ timesPerDay: 2 })]);
    expect(getTimesMismatchHint(group, ['MORNING', 'DINNER'])).toBeNull();
    expect(getTimesMismatchHint(group, ['MORNING', 'LUNCH', 'DINNER'])).toBe('봉투에는 하루 2번이에요');
    const [unknown] = groupDrugsByTimesPerDay([draftDrug()]);
    expect(getTimesMismatchHint(unknown, ['MORNING', 'LUNCH'])).toBeNull();
  });

  it('칩을 누르면 넣고 빼며 순서는 아침→자기 전', () => {
    expect(toggleSlot(['DINNER'], 'MORNING')).toEqual(['MORNING', 'DINNER']);
    expect(toggleSlot(['MORNING', 'DINNER'], 'MORNING')).toEqual(['DINNER']);
  });

  it('줄 하나를 일괄 등록 요청으로 바꾼다(아침 08·점심 12·저녁 19·자기 전 21시)', () => {
    const [group] = groupDrugsByTimesPerDay([
      draftDrug({ name: ' 타이레놀 ', doseAmount: 0.5 }),
      draftDrug({ name: '무코스타정', doseAmount: 1 }),
    ]);
    expect(groupToBatchRequest(group, ['BEDTIME', 'MORNING', 'LUNCH', 'DINNER'])).toEqual({
      drugs: [
        { name: '타이레놀', doseAmount: 0.5 },
        { name: '무코스타정', doseAmount: 1 },
      ],
      times: [{ doseTime: '08:00:00' }, { doseTime: '12:00:00' }, { doseTime: '19:00:00' }, { doseTime: '21:00:00' }],
    });
  });
});

describe('복용량', () => {
  it('반알 ↔ 1알 ↔ 2알', () => {
    expect(increaseDose(0.5)).toBe(1);
    expect(increaseDose(1)).toBe(2);
    expect(increaseDose(1.5)).toBe(2);
    expect(decreaseDose(2)).toBe(1);
    expect(decreaseDose(1)).toBe(0.5);
    expect(decreaseDose(0.5)).toBe(0.5);
    expect(decreaseDose(1.5)).toBe(1);
    expect(increaseDose(99)).toBe(99);
  });

  it('0.5 단위로 맞추고 범위 밖은 자른다', () => {
    expect(normalizeDoseAmount(0.3)).toBe(0.5);
    expect(normalizeDoseAmount(1.4)).toBe(1.5);
    expect(normalizeDoseAmount(0)).toBe(1);
    expect(normalizeDoseAmount(500)).toBe(99);
    expect(normalizeDoseAmount(-1)).toBe(1);
    expect(normalizeDoseAmount(Number.NaN)).toBe(1);
    expect(normalizeDoseAmount(0.25)).toBe(0.5);
    expect(normalizeDoseAmount(1.25)).toBe(1.5);
  });

  it('표시 문구', () => {
    expect(formatDoseLabel(0.5)).toBe('반알');
    expect(formatDoseLabel(1)).toBe('1알');
    expect(formatDoseLabel(1.5)).toBe('1알 반');
  });
});

describe('1/2 검증', () => {
  it('이름이 빈 행이 있거나 이름이 겹치면 다음으로 갈 수 없다', () => {
    expect(canProceedDrugs([createEmptyDrug()])).toBe(false);
    expect(canProceedDrugs([draftDrug({ name: '타이레놀' })])).toBe(true);
    expect(canProceedDrugs([])).toBe(false);

    const dup = [draftDrug({ name: '타이레놀' }), draftDrug({ name: ' 타이레놀 ' })];
    expect(findDuplicateDrugKeys(dup).size).toBe(2);
    expect(canProceedDrugs(dup)).toBe(false);

    // 줄이 달라도(하루 횟수가 달라도) 같은 이름은 막는다
    expect(canProceedDrugs([draftDrug({ name: 'A', timesPerDay: 3 }), draftDrug({ name: 'a', timesPerDay: 2 })])).toBe(
      false,
    );
  });

  it('이름 중복은 BE와 같은 기준(공백 묶기·보이지 않는 문자 제거·대소문자 무시)으로 본다 (점검 L-4)', () => {
    expect(normalizeDrugName(' Tylenol  정​ ')).toBe('tylenol 정');
    expect(canProceedDrugs([draftDrug({ name: '타이레놀 정' }), draftDrug({ name: '타이레놀​  정' })])).toBe(false);
    // 보이지 않는 문자만 있는 이름은 빈 이름이다
    expect(canProceedDrugs([draftDrug({ name: '​​' })])).toBe(false);
  });
});
