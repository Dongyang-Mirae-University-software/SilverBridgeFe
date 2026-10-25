import { describe, expect, it } from 'vitest';

import { guardianAnomalyHistoryQueryKey, guardianAnomalyHistorySummaryQueryOptions } from './anomaly';

describe('guardianAnomalyHistorySummaryQueryOptions', () => {
  // 실시간 감지(WS)·푸시·판정은 이력 키만 무효화한다 - 요약 키가 그 아래에 있어야 "확인 필요" 건수도 함께 갱신된다
  it('요약 쿼리 키는 이력 쿼리 키로 시작한다', () => {
    const key = guardianAnomalyHistorySummaryQueryOptions('W1').queryKey;
    expect(key.slice(0, guardianAnomalyHistoryQueryKey.length)).toEqual([...guardianAnomalyHistoryQueryKey]);
    expect(guardianAnomalyHistorySummaryQueryOptions().queryKey).not.toEqual(key);
  });
});
