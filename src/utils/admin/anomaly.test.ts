import { describe, expect, it } from 'vitest';

import { getAnomalyTypeCount } from './anomaly';

describe('관리자 이상감지 유형 탭 숫자 (QA ADM-A13·ADM-N29)', () => {
  const summary = { byType: [{ type: 'FIRE' as const, label: '화재', count: 3 }, { type: 'FALL' as const, label: '낙상', count: 1 }, { type: 'WEAPON' as const, label: '흉기', count: 1 }] };

  it('실제 응답의 type 칸으로 유형별 숫자를 찾는다', () => {
    expect(getAnomalyTypeCount(summary, 'FIRE')).toBe(3);
    expect(getAnomalyTypeCount(summary, 'FALL')).toBe(1);
  });

  it('전체는 유형 필터와 상관없이 유형별 합계다', () => {
    expect(getAnomalyTypeCount(summary, 'ALL')).toBe(5);
  });

  it('Swagger 형식(detectedType)도 읽고, 없는 유형은 undefined(-)다', () => {
    expect(getAnomalyTypeCount({ byType: [{ detectedType: 'FIRE', count: 2 }] }, 'FIRE')).toBe(2);
    expect(getAnomalyTypeCount({ byType: [{ detectedType: 'FIRE', count: 2 }] }, 'WEAPON')).toBeUndefined();
  });
});
