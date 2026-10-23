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
    // 두 약은 같은 아침 묶음 - 등록 전이었던 약은 묶음 판정에서 빠져 "1번 중 0번"
    await expect.element(screen.getByText('아침 약이 아직 다 체크되지 않았어요')).toBeVisible();
    await expect.element(screen.getByText(/1번 중/)).toBeVisible();
    await screen.getByRole('button', { name: /아침/ }).click();
    await expect.element(screen.getByText('오늘은 등록 전이었어요')).toBeVisible();
  });

  it('약 6개 × 하루 3번은 "3번 중"으로 세고, 시간대 한 줄을 누르면 그 시간 약이 펼쳐진다 (2026-10-23)', async () => {
    const names = ['코싹열정', '신일이부프로펜정400mg', '알마겔정', '소말겐정', '엘도스캡슐', '코푸시럽'];
    const slots = [
      { timeSlot: 'MORNING', doseTime: '00:00:00' },
      { timeSlot: 'LUNCH', doseTime: '00:01:00' },
      { timeSlot: 'DINNER', doseTime: '00:02:00' },
    ] as const;
    let id = 0;
    const meds = slots.flatMap((slot, index) =>
      names.map(name => med(++id, { name, ...slot, taken: index === 0 || (index === 1 && name !== '코푸시럽') })),
    );
    const screen = renderCard(meds);

    await expect.element(screen.getByText(/3번 중/)).toBeVisible();
    await expect.element(screen.getByText('1번', { exact: true })).toBeVisible();
    expect(screen.getByText(/18번/).query()).toBeNull();
    await expect.element(screen.getByText('점심·저녁 약이 아직 다 체크되지 않았어요')).toBeVisible();

    // 처음에는 시간대 한 줄씩 - 약 이름은 요약만
    const morning = screen.getByRole('button', { name: /아침/ });
    await expect.element(morning).toHaveAttribute('aria-expanded', 'false');
    await expect.element(screen.getByText('다 드셨어요')).toBeVisible();
    await expect.element(screen.getByText('6개 중 5개 드셨어요')).toBeVisible();
    await expect.element(screen.getByText('아직 체크 전이에요')).toBeVisible();
    expect(screen.getByRole('button', { name: '코싹열정 삭제' }).query()).toBeNull();

    await screen.getByRole('button', { name: /점심/ }).click();
    await expect.element(screen.getByRole('button', { name: /점심/ })).toHaveAttribute('aria-expanded', 'true');
    // 펼친 시간대의 약만 수정·삭제 버튼이 보인다
    expect(screen.getByRole('button', { name: '코싹열정 삭제' }).elements()).toHaveLength(1);
    await expect.element(screen.getByRole('button', { name: '신일이부프로펜정400mg 수정' })).toBeVisible();
    // 375px에서 가로 넘침 없음
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
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
