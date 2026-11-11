import { describe, expect, it } from 'vitest';
import { wardMedicationDisplayName } from './displayName';

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
