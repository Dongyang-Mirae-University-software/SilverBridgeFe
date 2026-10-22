import { describe, expect, it } from 'vitest';

import { MedicationOcrDrug, MedicationOcrResponse } from '@/service/interface/medication';
import {
  canSubmitDraft,
  createEmptyDraft,
  decreaseDose,
  draftToBatchRequest,
  findDuplicateDrugKeys,
  formatDoseLabel,
  formatTimeOption,
  increaseDose,
  nextUnusedTime,
  normalizeDoseAmount,
  ocrResultToDraft,
  getSubmitLabel,
  MAX_DRUGS,
  normalizeDrugName,
  TIME_OPTIONS,
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

describe('ocrResultToDraft', () => {
  it('읽지 못했거나 약이 없으면 null', () => {
    expect(ocrResultToDraft(null)).toBeNull();
    expect(ocrResultToDraft(ocr([], false))).toBeNull();
    expect(ocrResultToDraft(ocr([]))).toBeNull();
    expect(ocrResultToDraft(ocr([drug({ name: '  ' })]))).toBeNull();
  });

  it('반 알은 0.5, 복용량을 못 읽으면 1알', () => {
    const draft = ocrResultToDraft(ocr([drug({ perDose: 0.5 }), drug({ name: '아스피린', perDose: null })]))!.draft;
    expect(draft.drugs.map(d => d.doseAmount)).toEqual([0.5, 1]);
  });

  it('시간대가 있으면 약들의 시간대를 합쳐 순서대로 1행씩', () => {
    const draft = ocrResultToDraft(
      ocr([drug({ slots: ['BEDTIME', 'MORNING'] }), drug({ name: '아스피린', slots: ['DINNER'] })]),
    )!.draft;
    expect(draft.times.map(t => t.time)).toEqual(['08:00', '18:00', '22:00']);
  });

  it('시간대가 없으면 하루 횟수로 정한다', () => {
    const times = (n: number | null) => ocrResultToDraft(ocr([drug({ timesPerDay: n })]))!.draft.times.map(t => t.time);
    expect(times(1)).toEqual(['08:00']);
    expect(times(2)).toEqual(['08:00', '18:00']);
    expect(times(3)).toEqual(['08:00', '13:00', '18:00']);
    expect(times(null)).toEqual(['08:00']);
  });

  it('확신 낮은 약 표시, 복용 안내는 메모로', () => {
    const { draft } = ocrResultToDraft(ocr([drug({ confidence: 'low', timing: '식후 30분' })]))!;
    expect(draft.drugs[0].lowConfidence).toBe(true);
    expect(draft.memo).toBe('식후 30분');
  });
});

describe('ocrResultToDraft 경계 (2026-10-22 점검 M-4·M-5)', () => {
  it('약마다 복용 안내가 다르면 메모를 비우고 알린다', () => {
    const differ = ocrResultToDraft(ocr([drug({ timing: '식후 30분' }), drug({ name: '아스피린', timing: '취침 전' })]))!;
    expect(differ.draft.memo).toBe('');
    expect(differ.timingVaries).toBe(true);

    // 일부 약만 안내가 있어도 다른 약에 붙이지 않는다
    const partial = ocrResultToDraft(ocr([drug({ timing: '식후 30분' }), drug({ name: '아스피린', timing: null })]))!;
    expect(partial.draft.memo).toBe('');
    expect(partial.timingVaries).toBe(true);

    const same = ocrResultToDraft(ocr([drug({ timing: '식후 30분' }), drug({ name: '아스피린', timing: ' 식후 30분 ' })]))!;
    expect(same.draft.memo).toBe('식후 30분');
    expect(same.timingVaries).toBe(false);

    const none = ocrResultToDraft(ocr([drug(), drug({ name: '아스피린' })]))!;
    expect(none.timingVaries).toBe(false);
  });

  it(`약이 ${MAX_DRUGS}개를 넘으면 앞의 ${MAX_DRUGS}개만 가져오고 알린다`, () => {
    const many = Array.from({ length: MAX_DRUGS + 3 }, (_, i) => drug({ name: `약${i}` }));
    const result = ocrResultToDraft(ocr(many))!;
    expect(result.draft.drugs).toHaveLength(MAX_DRUGS);
    expect(result.draft.drugs[0].name).toBe('약0');
    expect(result.truncated).toBe(true);
    expect(ocrResultToDraft(ocr(many.slice(0, MAX_DRUGS)))!.truncated).toBe(false);
  });

  it('긴 이름·안내는 100자로 자른다', () => {
    const { draft } = ocrResultToDraft(ocr([drug({ name: '가'.repeat(150), timing: '나'.repeat(150) })]))!;
    expect(draft.drugs[0].name).toHaveLength(100);
    expect(draft.memo).toHaveLength(100);
  });

  it('하루 횟수 0은 아침, 4 이상은 네 번', () => {
    const times = (n: number) => ocrResultToDraft(ocr([drug({ timesPerDay: n })]))!.draft.times.map(t => t.time);
    expect(times(0)).toEqual(['08:00']);
    expect(times(4)).toEqual(['08:00', '13:00', '18:00', '22:00']);
    expect(times(6)).toEqual(['08:00', '13:00', '18:00', '22:00']);
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

describe('양식 검증·요청', () => {
  it('이름이 빈 행이 있거나 이름·시각이 겹치면 등록 불가', () => {
    const draft = createEmptyDraft();
    expect(canSubmitDraft(draft)).toBe(false);
    draft.drugs[0].name = '타이레놀';
    expect(canSubmitDraft(draft)).toBe(true);

    const dupName = { ...draft, drugs: [...draft.drugs, { ...draft.drugs[0], key: 'x', name: ' 타이레놀 ' }] };
    expect(findDuplicateDrugKeys(dupName.drugs).size).toBe(2);
    expect(canSubmitDraft(dupName)).toBe(false);

    const dupTime = { ...draft, times: [...draft.times, { key: 'y', time: '08:00' }] };
    expect(canSubmitDraft(dupTime)).toBe(false);
  });

  it('이름 중복은 BE와 같은 기준(공백 묶기·보이지 않는 문자 제거·대소문자 무시)으로 본다 (점검 L-4)', () => {
    expect(normalizeDrugName(' Tylenol  정\u200b ')).toBe('tylenol 정');
    const draft = createEmptyDraft();
    draft.drugs = [
      { key: 'a', name: '타이레놀 정', doseAmount: 1, lowConfidence: false },
      { key: 'b', name: '타이레놀\u200b  정', doseAmount: 1, lowConfidence: false },
    ];
    expect(findDuplicateDrugKeys(draft.drugs).size).toBe(2);
    expect(canSubmitDraft(draft)).toBe(false);

    // 보이지 않는 문자만 있는 이름은 빈 이름이다
    draft.drugs = [{ key: 'c', name: '\u200b\u200b', doseAmount: 1, lowConfidence: false }];
    expect(canSubmitDraft(draft)).toBe(false);
  });

  it('일괄 등록 요청으로 바꾼다', () => {
    const draft = createEmptyDraft();
    draft.drugs[0] = { ...draft.drugs[0], name: ' 타이레놀 ', doseAmount: 0.5 };
    draft.times.push({ key: 'z', time: '18:00' });
    expect(draftToBatchRequest(draft)).toEqual({
      drugs: [{ name: '타이레놀', doseAmount: 0.5 }],
      times: [{ doseTime: '08:00:00' }, { doseTime: '18:00:00' }],
    });
    expect(draftToBatchRequest({ ...draft, memo: ' 식후 ' }).memo).toBe('식후');
  });

  it('버튼 문구', () => {
    expect(getSubmitLabel(1)).toBe('등록');
    expect(getSubmitLabel(3)).toBe('약 3개 등록');
  });

  it('시간 선택지는 30분 간격, 다음 시각은 안 쓴 기본 시각부터', () => {
    expect(TIME_OPTIONS).toHaveLength(48);
    expect(TIME_OPTIONS[17]).toBe('08:30');
    expect(formatTimeOption('08:00')).toBe('오전 8:00');
    expect(formatTimeOption('18:30')).toBe('오후 6:30');
    expect(nextUnusedTime(['08:00'])).toBe('13:00');
    expect(nextUnusedTime(['08:00', '13:00', '18:00', '22:00'])).toBe('00:00');
  });
});
