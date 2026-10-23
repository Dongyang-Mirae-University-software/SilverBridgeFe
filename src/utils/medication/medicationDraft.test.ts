import { AxiosError, AxiosHeaders } from 'axios';
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
  getMixedTimesNote,
  getTimesMismatchHint,
  groupToBatchRequest,
  increaseDose,
  isUncertainFailure,
  MAX_DRUGS,
  needsNameCheck,
  normalizeDoseAmount,
  normalizeDrugName,
  ocrResultToDraft,
  renameDrug,
  toDoseGroup,
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

  it('허가 목록에 없는 이름(inList=false)만 표시하고 제안을 붙인다 - 대조 못 함(null)·옛 응답은 경고하지 않는다', () => {
    const { drugs } = ocrResultToDraft(
      ocr([
        drug({ name: '슈다페트정', inList: false, suggestions: ['슈다페드정', '슈도에페드린정'] }),
        drug({ name: '아스피린', inList: null, suggestions: [] }),
        drug({ name: '코싹엘정' }), // 칸이 없는 옛 응답
        drug({ name: '타이레놀정', inList: true, suggestions: ['무시됨'] }),
      ]),
    )!;
    expect(drugs.map(d => d.notInList)).toEqual([true, false, false, false]);
    expect(drugs.map(d => d.suggestions)).toEqual([['슈다페드정', '슈도에페드린정'], [], [], []]);
    // 확신(confidence)과 별개다 - high여도 목록에 없으면 확인 대상
    expect(drugs.map(needsNameCheck)).toEqual([true, false, false, false]);
  });

  it('제안은 공백·빈 값·100자 초과·중복을 빼고 최대 3개', () => {
    const [first] = ocrResultToDraft(
      ocr([drug({ inList: false, suggestions: [' 가정 ', '', '  ', '나'.repeat(101), '가정', '다정', '라정', '마정'] })]),
    )!.drugs;
    expect(first.suggestions).toEqual(['가정', '다정', '라정']);
    expect(ocrResultToDraft(ocr([drug({ inList: false })]))!.drugs[0].suggestions).toEqual([]);
  });

  it('확신 low 또는 목록에 없는 이름이면 이름 확인 대상', () => {
    expect(needsNameCheck(draftDrug({ lowConfidence: true }))).toBe(true);
    expect(needsNameCheck(draftDrug({ notInList: true }))).toBe(true);
    expect(needsNameCheck(draftDrug())).toBe(false);
  });

  it('이름을 고치면(직접·제안 칩) 강조·안내·제안을 끈다', () => {
    const flagged = draftDrug({ lowConfidence: true, notInList: true, suggestions: ['가정'] });
    const renamed = { ...flagged, ...renameDrug('가정') };
    expect(renamed).toMatchObject({ name: '가정', lowConfidence: false, notInList: false, suggestions: [] });
    expect(needsNameCheck(renamed)).toBe(false);
    expect(createEmptyDrug()).toMatchObject({ notInList: false, suggestions: [] });
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

describe('통합 "언제 드세요?" (2026-10-22 사용자 결정 - 줄 나눔 대신 한 줄 + 안내)', () => {
  it('하루 횟수가 모두 같을 때만 그 값을 갖는다(섞이거나 모르면 null)', () => {
    expect(toDoseGroup([draftDrug({ timesPerDay: 3 }), draftDrug({ timesPerDay: 3 })]).timesPerDay).toBe(3);
    expect(toDoseGroup([draftDrug({ timesPerDay: 3 }), draftDrug()]).timesPerDay).toBe(3);
    expect(toDoseGroup([draftDrug({ timesPerDay: 3 }), draftDrug({ timesPerDay: 2 })]).timesPerDay).toBeNull();
    expect(toDoseGroup([draftDrug(), draftDrug()]).timesPerDay).toBeNull();
  });

  it('횟수가 섞이면 가장 많은 약의 횟수와 다른 약을 한 줄로 알린다', () => {
    const drugs = [
      draftDrug({ name: '신일이부프로펜정', timesPerDay: 3 }),
      draftDrug({ name: '코싹엘정', timesPerDay: 2 }),
      draftDrug({ name: '뮤테란캡슐', timesPerDay: 3 }),
      draftDrug({ name: '직접 쓴 약' }),
    ];
    expect(getMixedTimesNote(drugs)).toBe(
      '코싹엘정 하루 2번 - 다른 약과 하루 횟수가 달라요. 다르게 드시는 약은 등록 후 시간을 고쳐 주세요',
    );
    // 다른 약이 여럿이면 "외 N개", 횟수가 여럿이면 큰 횟수부터
    expect(
      getMixedTimesNote([
        draftDrug({ name: 'A', timesPerDay: 3 }),
        draftDrug({ name: 'B', timesPerDay: 3 }),
        draftDrug({ name: 'C', timesPerDay: 1 }),
        draftDrug({ name: 'D', timesPerDay: 1 }),
        draftDrug({ name: 'E', timesPerDay: 2 }),
      ]),
    ).toBe('E 하루 2번, C 외 1개 하루 1번 - 다른 약과 하루 횟수가 달라요. 다르게 드시는 약은 등록 후 시간을 고쳐 주세요');
    // 같은 수로 갈리면 큰 횟수를 기준으로 본다
    expect(getMixedTimesNote([draftDrug({ name: 'A', timesPerDay: 3 }), draftDrug({ name: 'B', timesPerDay: 2 })])).toMatch(
      /^B 하루 2번/,
    );
  });

  it('최빈 횟수와 최대 횟수가 다르면 최빈을 기준으로 본다(2·2·3이면 하루 3번 약을 알린다) (점검 L-4)', () => {
    expect(
      getMixedTimesNote([
        draftDrug({ name: 'A', timesPerDay: 2 }),
        draftDrug({ name: 'B', timesPerDay: 2 }),
        draftDrug({ name: 'C', timesPerDay: 3 }),
      ]),
    ).toMatch(/^C 하루 3번 - /);
  });

  it('가장 많은 약의 횟수가 5번 이상이면 4번까지만 고를 수 있다고 덧붙인다 (점검 L-5)', () => {
    expect(
      getMixedTimesNote([
        draftDrug({ name: 'A', timesPerDay: 5 }),
        draftDrug({ name: 'B', timesPerDay: 5 }),
        draftDrug({ name: 'C', timesPerDay: 2 }),
      ]),
    ).toBe('C 하루 2번 - 다른 약과 하루 횟수가 달라요. 다르게 드시는 약은 등록 후 시간을 고쳐 주세요. 여기서는 4번까지 고를 수 있어요');
  });

  it('횟수가 같거나 모르면 안내하지 않는다', () => {
    expect(getMixedTimesNote([draftDrug({ timesPerDay: 3 }), draftDrug({ timesPerDay: 3 }), draftDrug()])).toBeNull();
    expect(getMixedTimesNote([draftDrug(), draftDrug()])).toBeNull();
  });
});

describe('기본 선택', () => {
  const pick = (drugs: DraftDrug[]) => defaultSlotsForGroup(toDoseGroup(drugs));

  it('봉투 시간대 표시 개수가 하루 횟수와 같으면 표시대로, 다르면 횟수로', () => {
    expect(pick([draftDrug({ timesPerDay: 3, slots: ['MORNING', 'LUNCH', 'DINNER'] })])).toEqual(['MORNING', 'LUNCH', 'DINNER']);
    expect(pick([draftDrug({ timesPerDay: 2, slots: ['MORNING', 'LUNCH', 'DINNER'] })])).toEqual(['MORNING', 'DINNER']);
  });

  it('횟수가 섞이면 봉투 표시를 쓰고, 표시가 없으면 가장 큰 횟수로', () => {
    expect(
      pick([draftDrug({ timesPerDay: 3, slots: ['MORNING', 'BEDTIME'] }), draftDrug({ timesPerDay: 2 })]),
    ).toEqual(['MORNING', 'BEDTIME']);
    expect(pick([draftDrug({ timesPerDay: 3 }), draftDrug({ timesPerDay: 2 })])).toEqual(['MORNING', 'LUNCH', 'DINNER']);
  });

  it('표시가 없으면 하루 횟수로, 정보가 없으면 아침', () => {
    const one = (timesPerDay: number | null) => pick([draftDrug({ timesPerDay })]);
    expect(one(1)).toEqual(['MORNING']);
    expect(one(2)).toEqual(['MORNING', 'DINNER']);
    expect(one(3)).toEqual(['MORNING', 'LUNCH', 'DINNER']);
    expect(one(4)).toEqual(['MORNING', 'LUNCH', 'DINNER', 'BEDTIME']);
    expect(one(6)).toEqual(['MORNING', 'LUNCH', 'DINNER', 'BEDTIME']);
    expect(one(null)).toEqual(['MORNING']);
  });

  it('하루 횟수를 모르면 봉투 표시를 그대로 쓴다', () => {
    expect(pick([draftDrug({ slots: ['LUNCH'] })])).toEqual(['LUNCH']);
  });
});

describe('2/2 칩', () => {
  it('고른 칸 수가 하루 횟수와 다르면 안내(모르면 안내 없음)', () => {
    const group = toDoseGroup([draftDrug({ timesPerDay: 2 })]);
    expect(getTimesMismatchHint(group, ['MORNING', 'DINNER'])).toBeNull();
    expect(getTimesMismatchHint(group, ['MORNING', 'LUNCH', 'DINNER'])).toBe('봉투에는 하루 2번이에요');
    // 칩은 4개라 하루 5번 이상이면 그 사실도 알린다 (점검 L-4)
    const five = toDoseGroup([draftDrug({ timesPerDay: 5 })]);
    expect(getTimesMismatchHint(five, ['MORNING', 'LUNCH', 'DINNER', 'BEDTIME'])).toBe(
      '봉투에는 하루 5번이에요. 여기서는 4번까지 고를 수 있어요',
    );
    const unknown = toDoseGroup([draftDrug()]);
    expect(getTimesMismatchHint(unknown, ['MORNING', 'LUNCH'])).toBeNull();
    // 직접 넣은 약(횟수 모름)이 섞이면 봉투에 적힌 약에만 해당한다고 밝힌다 (점검 L-5)
    expect(getTimesMismatchHint(toDoseGroup([draftDrug({ timesPerDay: 2 }), draftDrug()]), ['MORNING'])).toBe(
      '봉투에 적힌 약은 하루 2번이에요',
    );
    // 횟수가 섞이면(통합 줄) 이 안내 대신 getMixedTimesNote가 알린다
    expect(getTimesMismatchHint(toDoseGroup([draftDrug({ timesPerDay: 3 }), draftDrug({ timesPerDay: 2 })]), ['MORNING'])).toBeNull();
  });

  it('칩을 누르면 넣고 빼며 순서는 아침→자기 전', () => {
    expect(toggleSlot(['DINNER'], 'MORNING')).toEqual(['MORNING', 'DINNER']);
    expect(toggleSlot(['MORNING', 'DINNER'], 'MORNING')).toEqual(['DINNER']);
  });

  it('일괄 등록 요청으로 바꾼다(아침 08·점심 12·저녁 19·자기 전 21시)', () => {
    const group = toDoseGroup([
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

    // 하루 횟수가 달라도 같은 이름은 막는다
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

describe('등록 실패 - 결과를 모르는가 (점검 M-1)', () => {
  const withStatus = (status: number) =>
    new AxiosError('fail', 'ERR_BAD_RESPONSE', undefined, undefined, {
      status,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    });

  it('응답 없음·408·5xx는 결과를 모른다(다시 보내면 중복 등록일 수 있다)', () => {
    expect(isUncertainFailure(new AxiosError('timeout', 'ECONNABORTED'))).toBe(true);
    [408, 500, 502, 503, 504].forEach(status => expect(isUncertainFailure(withStatus(status))).toBe(true));
  });

  it('4xx는 BE가 처리 전에 거절한 것이라 다시 등록할 수 있다', () => {
    [400, 401, 403, 404, 409, 429].forEach(status => expect(isUncertainFailure(withStatus(status))).toBe(false));
    expect(isUncertainFailure(new Error('그 밖의 오류'))).toBe(false);
  });
});

