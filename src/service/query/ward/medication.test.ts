import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import type { MedicationItem, TodayMedicationResponse } from '@/service/interface/medication';
import { applyMedicationTakenToWardCache, wardTodayMedicationQueryKey } from './medication';

function cacheWith(doseDate: string) {
  const queryClient = new QueryClient();
  const medication: MedicationItem = {
    medicationId: 1,
    name: '혈압약',
    timeSlot: 'MORNING',
    doseTime: '08:00:00',
    doseAmount: 1,
    memo: null,
    taken: false,
    takenAt: null,
  };
  queryClient.setQueryData<TodayMedicationResponse>(wardTodayMedicationQueryKey, {
    doseDate,
    takenCount: 0,
    totalCount: 1,
    medications: [medication],
  });
  return queryClient;
}

const cached = (queryClient: QueryClient) =>
  queryClient.getQueryData<TodayMedicationResponse>(wardTodayMedicationQueryKey)!;

describe('applyMedicationTakenToWardCache (WS medication-taken)', () => {
  it('같은 날 체크는 그 자리에서 반영하고 개수도 맞춘다', () => {
    const queryClient = cacheWith('2026-10-25');
    applyMedicationTakenToWardCache(queryClient, { medicationId: '1', taken: 'true', doseDate: '2026-10-25' });
    expect(cached(queryClient).medications[0].taken).toBe(true);
    expect(cached(queryClient).takenCount).toBe(1);
  });

  // 점검 L-1: 자정 직전 체크의 늦은 이벤트가 다음 날 같은 약을 체크된 것처럼 바꿨다
  it('다른 날의 체크는 반영하지 않는다', () => {
    const queryClient = cacheWith('2026-10-25');
    applyMedicationTakenToWardCache(queryClient, { medicationId: '1', taken: 'true', doseDate: '2026-10-24' });
    expect(cached(queryClient).medications[0].taken).toBe(false);
    expect(cached(queryClient).takenCount).toBe(0);
  });

  it('날짜가 없는 옛 형식 이벤트는 예전처럼 반영한다', () => {
    const queryClient = cacheWith('2026-10-25');
    applyMedicationTakenToWardCache(queryClient, { medicationId: '1', taken: 'true' });
    expect(cached(queryClient).medications[0].taken).toBe(true);
  });
});
