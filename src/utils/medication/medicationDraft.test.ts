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
    const draft = ocrResultToDraft(ocr([drug({ perDose: 0.5 }), drug({ name: '아스피린', perDose: null })]))!;
    expect(draft.drugs.map(d => d.doseAmount)).toEqual([0.5, 1]);
  });

  it('시간대가 있으면 약들의 시간대를 합쳐 순서대로 1행씩', () => {
    const draft = ocrResultToDraft(
      ocr([drug({ slots: ['BEDTIME', 'MORNING'] }), drug({ name: '아스피린', slots: ['DINNER'] })]),
    )!;
    expect(draft.times.map(t => t.time)).toEqual(['08:00', '18:00', '22:00']);
  });

  it('시간대가 없으면 하루 횟수로 정한다', () => {
    const times = (n: number | null) => ocrResultToDraft(ocr([drug({ timesPerDay: n })]))!.times.map(t => t.time);
    expect(times(1)).toEqual(['08:00']);
    expect(times(2)).toEqual(['08:00', '18:00']);
    expect(times(3)).toEqual(['08:00', '13:00', '18:00']);
    expect(times(null)).toEqual(['08:00']);
  });

  it('확신 낮은 약 표시, 복용 안내는 메모로', () => {
    const draft = ocrResultToDraft(ocr([drug({ confidence: 'low', timing: '식후 30분' })]))!;
    expect(draft.drugs[0].lowConfidence).toBe(true);
    expect(draft.memo).toBe('식후 30분');
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
