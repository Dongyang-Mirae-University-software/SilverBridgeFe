import { describe, expect, it } from 'vitest';

import { medicationDisplayName } from './displayName';

describe('medicationDisplayName - BE 짧은 이름, 없으면 원래 이름', () => {
  it('displayName 이 있으면 그것을 쓴다', () => {
    expect(medicationDisplayName({ name: '다이아벡스정500밀리그램(메트포르민염산염)', displayName: '다이아벡스정' })).toBe('다이아벡스정');
  });

  it('옛 응답처럼 displayName 이 없거나(null·빈 값) 공백뿐이면 원래 이름을 쓴다', () => {
    expect(medicationDisplayName({ name: '혈압약 ' })).toBe('혈압약');
    expect(medicationDisplayName({ name: '혈압약', displayName: null })).toBe('혈압약');
    expect(medicationDisplayName({ name: '혈압약', displayName: '  ' })).toBe('혈압약');
  });

  it('FE 는 따로 줄이지 않는다 - 원래 이름이 길어도 displayName 이 없으면 그대로', () => {
    expect(medicationDisplayName({ name: '신일이부프로펜정400mg' })).toBe('신일이부프로펜정400mg');
  });
});
