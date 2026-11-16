import { describe, expect, it } from 'vitest';
import { wardMedicationDisplayName, wardMedicationDisplayNames } from './displayName';

describe('wardMedicationDisplayName', () => {
  it.each([
    ['신일이부프로펜정 400mg', '신일이부프로펜정'],
    ['타이레놀 500mg', '타이레놀'],
    ['게보린 300mg', '게보린'], // 9자
    ['아모잘탄정5/50mg', '아모잘탄정'],
    ['비타민D 1000IU', '비타민D'],
    ['리피토정 10 mg', '리피토정'],
    ['오메가3 1.5g', '오메가3'],
    ['시럽감기약 500mg/5mL', '시럽감기약'],
    ['코대원포르테 (20ml)', '코대원포르테'],
    ['노바스크정 5MCG', '노바스크정'],
    ['고농도비타민 C 2%', '고농도비타민 C'],
  ])('긴 이름 %s → %s', (name, expected) => {
    expect(wardMedicationDisplayName(name)).toBe(expected);
  });

  it.each([
    ['아스피린', '아스피린'],
    ['게보린300mg', '게보린300mg'], // 정확히 8자 - 그대로
    ['혈압약', '혈압약'],
  ])('짧은 이름은 그대로 %s', (name, expected) => {
    expect(wardMedicationDisplayName(name)).toBe(expected);
  });

  it('용량이 끝에 없는 긴 이름은 그대로', () => {
    expect(wardMedicationDisplayName('400mg 신일이부프로펜정')).toBe('400mg 신일이부프로펜정');
    expect(wardMedicationDisplayName('종합감기약 아침용')).toBe('종합감기약 아침용');
  });

  it('숫자로 끝나도 단위가 없으면 빼지 않는다', () => {
    expect(wardMedicationDisplayName('글리아타민 연질캡슐 2')).toBe('글리아타민 연질캡슐 2');
  });

  it('빼고 나서 비면 원래 이름', () => {
    expect(wardMedicationDisplayName('  1000mg/10ml ')).toBe('1000mg/10ml');
  });
});

describe('wardMedicationDisplayNames', () => {
  it('용량만 다른 같은 약은 원래 이름으로 둔다 - 나머지는 그대로 줄인다', () => {
    expect(wardMedicationDisplayNames(['아스피린정 100mg', '아스피린정 500mg', '타이레놀 500mg'])).toEqual([
      '아스피린정 100mg',
      '아스피린정 500mg',
      '타이레놀',
    ]);
  });

  it('줄인 이름이 겹치지 않으면 하나씩 줄인 것과 같다', () => {
    const names = ['신일이부프로펜정 400mg', '게보린 300mg', '비타민D'];
    expect(wardMedicationDisplayNames(names)).toEqual(names.map(wardMedicationDisplayName));
  });

  it('원래 이름까지 같은 약 두 개는 둘 다 줄인 이름 그대로', () => {
    expect(wardMedicationDisplayNames(['타이레놀 500mg', '타이레놀 500mg'])).toEqual(['타이레놀', '타이레놀']);
  });

  it('줄이지 않은 짧은 이름과 겹쳐도 긴 쪽은 원래 이름으로 구분한다', () => {
    expect(wardMedicationDisplayNames(['게보린', '게보린 300mg'])).toEqual(['게보린', '게보린 300mg']);
  });

  it('빈 목록', () => {
    expect(wardMedicationDisplayNames([])).toEqual([]);
  });
});
