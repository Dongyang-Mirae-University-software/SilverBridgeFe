import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import type { WardMedicationSummary } from '@/service/interface/medication';
import { applyMedicationTakenToGuardianCache, guardianMedicationQueryKey } from './medication';

function setup() {
  const client = new QueryClient();
  client.setQueryData<WardMedicationSummary[]>(guardianMedicationQueryKey, [
    {
      wardId: 'W1',
      wardName: '김영자',
      age: 80,
      remindAgainEnabled: false,
      missedAlertEnabled: false,
      missedAlertTime: '22:30:00',
      doseDate: '2026-11-14',
      takenCount: 0,
      totalCount: 1,
      medications: [{ medicationId: 7, taken: false, takenAt: null }],
    } as unknown as WardMedicationSummary,
  ]);
  const read = () => client.getQueryData<WardMedicationSummary[]>(guardianMedicationQueryKey)![0];
  return { client, read };
}

describe('보호자 복약 카드 실시간 반영 (QA CONN-A37)', () => {
  it('오늘 날짜 신호면 그 약을 드셨어요로 바꾼다', () => {
    const { client, read } = setup();
    applyMedicationTakenToGuardianCache(client, { wardId: 'W1', medicationId: '7', taken: 'true', takenAt: '2026-11-14T09:00:00+09:00', doseDate: '2026-11-14' });

    expect(read().medications[0].taken).toBe(true);
    expect(read().takenCount).toBe(1);
  });

  it('어제 날짜 신호는 오늘 카드를 바꾸지 않는다', () => {
    const { client, read } = setup();
    applyMedicationTakenToGuardianCache(client, { wardId: 'W1', medicationId: '7', taken: 'true', doseDate: '2026-11-13' });

    expect(read().medications[0].taken).toBe(false);
    expect(read().takenCount).toBe(0);
  });
});
