// 보호자 복약 카드 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { MedicationItem, WardMedicationSummary } from '@/service/interface/medication';
import { WardMedicationCard } from './WardMedicationCard';

const api = vi.hoisted(() => ({
  deleteWardMedicationBatch: vi.fn(),
  deleteGuardianMedication: vi.fn(),
  getGuardianMedications: vi.fn(),
}));

vi.mock('@/service/api/guardian/medication', async importOriginal => ({
  ...(await importOriginal<object>()),
  deleteWardMedicationBatch: api.deleteWardMedicationBatch,
  deleteGuardianMedication: api.deleteGuardianMedication,
  getGuardianMedications: api.getGuardianMedications,
}));

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
    vi.restoreAllMocks();
    api.deleteWardMedicationBatch.mockReset();
    api.deleteGuardianMedication.mockReset();
    api.getGuardianMedications.mockReset();
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
    // 펼친 뒤에는 "점심 약 모두 삭제"도 있어 펼침 머리(aria-expanded가 있는 버튼)만 고른다
    await expect.element(screen.getByRole('button', { name: /점심/, expanded: true })).toBeVisible();
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

  // ─── 여러 개 삭제 (2026-10-23, BE #371) ───────────────────────────
  function threeSlots() {
    const names = ['코싹열정', '알마겔정'];
    let id = 0;
    return (['MORNING', 'LUNCH', 'DINNER'] as const).flatMap((timeSlot, index) =>
      names.map(name => med(++id, { name, timeSlot, doseTime: `0${index}:00:00` })),
    );
  }

  it('펼친 시간대의 "점심 약 모두 삭제" - 확인하면 그 시간 약 ID만 보내고, 취소하면 보내지 않는다', async () => {
    api.deleteWardMedicationBatch.mockResolvedValue(2);
    api.getGuardianMedications.mockResolvedValue([]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const screen = renderCard(threeSlots());

    await screen.getByRole('button', { name: /점심/ }).first().click();
    const groupDelete = screen.getByRole('button', { name: '점심 약 모두 삭제' });
    await groupDelete.click();
    expect(confirm).toHaveBeenLastCalledWith('점심 약 2개를 모두 삭제할까요? 지난 복용 이력은 남습니다.');
    expect(api.deleteWardMedicationBatch).not.toHaveBeenCalled();

    await groupDelete.click();
    await vi.waitFor(() => expect(api.deleteWardMedicationBatch).toHaveBeenCalledWith('W1', [3, 4]));
  });

  it('"약 전부 삭제" - 화면의 약 전부를 보내고, 실패하면 안내한다', async () => {
    api.deleteWardMedicationBatch.mockRejectedValue(new Error('network'));
    api.getGuardianMedications.mockResolvedValue([]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const screen = renderCard(threeSlots());

    await screen.getByRole('button', { name: '약 전부 삭제' }).click();
    expect(confirm).toHaveBeenCalledWith('김순자 님의 약 6개를 모두 삭제할까요? 지난 복용 이력은 남습니다.');
    await vi.waitFor(() => expect(api.deleteWardMedicationBatch).toHaveBeenCalledWith('W1', [1, 2, 3, 4, 5, 6]));
    await expect.element(screen.getByRole('alert')).toHaveTextContent('삭제하지 못했어요');
  });

  it('약이 하나뿐이면 묶음 삭제·전부 삭제 버튼을 두지 않는다(단건 삭제로 충분)', async () => {
    const screen = renderCard([med(1, { name: '혈압약' })]);
    await screen.getByRole('button', { name: /아침/ }).first().click();
    await expect.element(screen.getByRole('button', { name: '혈압약 삭제' })).toBeVisible();
    expect(screen.getByRole('button', { name: /모두 삭제|전부 삭제/ }).query()).toBeNull();
  });

  it('약 하나 삭제가 실패해도 안내하고 목록을 다시 불러온다 (점검 L-2)', async () => {
    api.deleteGuardianMedication.mockRejectedValue(new Error('network'));
    api.getGuardianMedications.mockResolvedValue([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // 이 카드는 목록을 props로 받아 쿼리를 구독하지 않으므로, 재조회 대신 목록 무효화 호출을 본다
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    const screen = renderCard([med(1, { name: '혈압약' })]);

    await screen.getByRole('button', { name: /아침/ }).first().click();
    await screen.getByRole('button', { name: '혈압약 삭제' }).click();

    await vi.waitFor(() => expect(api.deleteGuardianMedication).toHaveBeenCalledWith(1));
    await expect.element(screen.getByRole('alert')).toHaveTextContent('삭제하지 못했어요');
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled());
  });
});
