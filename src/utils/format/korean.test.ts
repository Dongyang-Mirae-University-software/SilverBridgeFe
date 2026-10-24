import { describe, expect, it } from 'vitest';

import { getAndParticle, getObjectParticle, getSubjectParticle } from './korean';

describe('이름에 바로 붙는 조사 - 이름 뒤 "님"을 붙이지 않으므로 받침으로 고른다 (2026-10-24)', () => {
  it('받침이 있으면 이·과·을, 없으면 가·와·를', () => {
    expect([getSubjectParticle('박민철'), getAndParticle('박민철'), getObjectParticle('박민철')]).toEqual(['이', '과', '을']);
    expect([getSubjectParticle('김영희'), getAndParticle('김영희'), getObjectParticle('김영희')]).toEqual(['가', '와', '를']);
  });

  it('한글이 아니면 받침 없음으로 본다', () => {
    expect([getAndParticle('Kim'), getObjectParticle('')]).toEqual(['와', '를']);
  });
});
