// 보호자 복약 카드 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { MedicationItem, WardMedicationSummary } from '@/service/interface/medication';
import { WardMedicationCard } from './WardMedicationCard';

vi.mock('@/service/query/guardian/notification', () => ({
  guardianNotificationTypeSettingQueryOptions: { queryKey: ['guardian-notification-type-test'], queryFn: () => null },
}));

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

// 복용 시각 00:00 약은 언제 돌려도 "시간이 지난 약"이라 시계에 의존하지 않는다
function med(id: number, overrides: Partial<MedicationItem> = {}): MedicationItem {
  return {
    medicationId: id,
    name: `약${id}`,
    timeSlot: 'MORNING',
    doseTime: '00:00:00',
    doseAmount: 1,
    memo: null,
    taken: false,
    takenAt: null,
    createdAt: null,
    ...overrides,
  };
}

function renderCard(medications: MedicationItem[]) {
  const summary: WardMedicationSummary = {
    wardId: 'W1',
    wardName: '김순자',
    age: 80,
    alarmEnabled: true,
    remindAgainEnabled: true,
    missedAlertEnabled: true,
    missedAlertTime: '21:00:00',
    doseDate: TODAY,
    takenCount: medications.filter(m => m.taken).length,
    totalCount: medications.length,
    medications,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );
  return render(<WardMedicationCard summary={summary} />, { wrapper });
}

describe('WardMedicationCard (Chrome)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('오늘 등록 전에 지난 약은 "오늘은 등록 전이었어요"로, 지난 약 개수에서 뺀다', async () => {
    const screen = renderCard([
      med(1, { createdAt: `${TODAY}T00:30:00+09:00` }),
      med(2, { createdAt: '2026-01-01T09:00:00+09:00' }),
    ]);
    await expect.element(screen.getByText('오늘은 등록 전이었어요')).toBeVisible();
    await expect.element(screen.getByText('드실 시간이 지난 약 1개가 아직 체크 전이에요')).toBeVisible();
  });

  it('체크한 약이 없고 체크할 약도 없으면 "모두 드셨어요"라고 하지 않는다 (점검 L-2)', async () => {
    const screen = renderCard([med(1, { createdAt: `${TODAY}T00:30:00+09:00` })]);
    await expect.element(screen.getByText('지금 체크할 약은 없어요')).toBeVisible();
    expect(screen.getByText('지금까지 드실 약은 모두 드셨어요').query()).toBeNull();
  });

  it('체크한 약이 있고 지난 약이 없으면 "모두 드셨어요"', async () => {
    const screen = renderCard([med(1, { taken: true }), med(2, { createdAt: `${TODAY}T00:30:00+09:00` })]);
    await expect.element(screen.getByText('지금까지 드실 약은 모두 드셨어요')).toBeVisible();
  });
});
