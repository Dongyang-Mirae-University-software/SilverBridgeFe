// 보호자 복약 카드 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`).
// Claude Design(2026-10-30): 위에 시간대 칸, 아래에 고른 시간대의 약. 삭제는 그 줄 안에서 확인한다.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Fragment, ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from '@vitest/browser/context';

import type { MedicationItem, WardMedicationSummary } from '@/service/interface/medication';
import useModalStore from '@/store/modalStore';
import { WardMedicationCard } from './WardMedicationCard';

const api = vi.hoisted(() => ({
  deleteGuardianMedication: vi.fn(),
  deleteWardMedicationBatch: vi.fn(),
  getGuardianMedications: vi.fn(),
  updateMedicationAlertSetting: vi.fn(),
}));

vi.mock('@/service/api/guardian/medication', async importOriginal => ({
  ...(await importOriginal<object>()),
  deleteGuardianMedication: api.deleteGuardianMedication,
  deleteWardMedicationBatch: api.deleteWardMedicationBatch,
  getGuardianMedications: api.getGuardianMedications,
  updateMedicationAlertSetting: api.updateMedicationAlertSetting,
}));

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: navigation.push }) }));

const notificationSetting = vi.hoisted(() => ({ value: null as null | { medication: { enabled: boolean } } }));
vi.mock('@/service/query/guardian/notification', () => ({
  guardianNotificationTypeSettingQueryOptions: {
    queryKey: ['guardian-notification-type-test'],
    queryFn: () => notificationSetting.value,
  },
}));

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

// 카드는 지금 시각으로 상단 문장·기본으로 펼칠 시간대를 정한다 - 실행 시각에 따라 결과가 바뀌지 않게 오늘 07:00(KST)으로 고정한다
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T07:00:00+09:00`));
});

afterAll(() => {
  vi.useRealTimers();
});

function medication(id: number, overrides: Partial<MedicationItem> = {}): MedicationItem {
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

function summary(medications: MedicationItem[]): WardMedicationSummary {
  return {
    wardId: 'W1',
    wardName: '김순자',
    age: 80,
    remindAgainEnabled: true,
    missedAlertEnabled: true,
    missedAlertTime: '21:00:00',
    doseDate: TODAY,
    takenCount: medications.filter(item => item.taken).length,
    totalCount: medications.length,
    medications,
  };
}

function ModalOutlet() {
  const modals = useModalStore(state => state.modals);
  return modals.map(modal => <Fragment key={modal.id}>{modal.Component}</Fragment>);
}

function renderCard(medications: MedicationItem[]) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const screen = render(<WardMedicationCard summary={summary(medications)} />, { wrapper });
  render(<ModalOutlet />, { wrapper });
  return screen;
}

describe('WardMedicationCard (Chrome)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    api.deleteGuardianMedication.mockReset();
    api.deleteWardMedicationBatch.mockReset();
    api.getGuardianMedications.mockReset();
    api.updateMedicationAlertSetting.mockReset();
    navigation.push.mockReset();
    notificationSetting.value = null;
  });

  it('시간대 칸을 고르면 그 시간대의 약과 상태를 보여 준다', async () => {
    const screen = renderCard([
      medication(2, { name: '수면제', timeSlot: 'BEDTIME', doseTime: '22:00:00', doseAmount: 0.5 }),
      medication(1, { name: '혈압약', timeSlot: 'MORNING', doseTime: '08:00:00', taken: true }),
    ]);

    const tiles = screen.getByRole('group', { name: '시간대 고르기' });
    await expect.element(tiles.getByRole('button', { name: /아침/ })).toHaveTextContent('✓ 드셨어요');
    // 끝나지 않은 첫 시간대가 기본으로 골라지고 "다음"으로 표시된다
    await expect.element(tiles.getByRole('button', { name: /취침 전/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tiles.getByRole('button', { name: /취침 전/ })).toHaveTextContent('다음');
    await expect.element(screen.getByRole('list', { name: '취침 전 약 목록' })).toHaveTextContent('수면제반 알');

    await tiles.getByRole('button', { name: /아침/ }).click();
    await expect.element(screen.getByRole('heading', { name: /아침 약/ })).toHaveTextContent('오전 8:00');
    await expect.element(screen.getByRole('list', { name: '아침 약 목록' })).toHaveTextContent('혈압약');
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('지난 시간대는 "안 드셨어요"로 단정하지 않고, 오늘 늦게 등록한 약은 등록 전으로 보여 준다', async () => {
    const screen = renderCard([
      medication(1, { name: '혈압약', timeSlot: 'MORNING', doseTime: '06:00:00' }),
      medication(2, { name: '위장약', timeSlot: 'LUNCH', doseTime: '06:30:00', createdAt: `${TODAY}T06:50:00+09:00` }),
    ]);

    const tiles = screen.getByRole('group', { name: '시간대 고르기' });
    await expect.element(tiles.getByRole('button', { name: /아침/ })).toHaveTextContent('체크되지 않았어요');
    await expect.element(tiles.getByRole('button', { name: /점심/ })).toHaveTextContent('등록 전');
    await tiles.getByRole('button', { name: /점심/ }).click();
    await expect.element(screen.getByText('오늘은 등록 전이었어요')).toBeVisible();
    expect(document.body.textContent).not.toContain('안 드셨어요');
  });

  it('수정 버튼은 늘 보이고, 삭제는 그 줄 안에서 확인한 뒤 지운다', async () => {
    api.deleteGuardianMedication.mockResolvedValue({});
    api.getGuardianMedications.mockResolvedValue([]);
    const confirm = vi.spyOn(window, 'confirm');
    const screen = renderCard([medication(1, { name: '혈압약' })]);

    await screen.getByRole('button', { name: '혈압약 수정' }).click();
    await expect.element(screen.getByRole('dialog', { name: '약 수정' })).toBeVisible();
    await screen.getByRole('dialog', { name: '약 수정' }).getByRole('button', { name: '닫기' }).click();

    // 취소하면 지우지 않고 휴지통으로 포커스가 돌아온다
    await screen.getByRole('button', { name: '혈압약 삭제', exact: true }).click();
    await expect.element(screen.getByText('삭제해도 지난 복용 이력은 남아요')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '취소' })).toHaveFocus();
    await screen.getByRole('button', { name: '취소' }).click();
    await expect.element(screen.getByRole('button', { name: '혈압약 삭제', exact: true })).toHaveFocus();
    expect(api.deleteGuardianMedication).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: '혈압약 삭제', exact: true }).click();
    await screen.getByRole('button', { name: '혈압약 삭제하기' }).click();
    await vi.waitFor(() => expect(api.deleteGuardianMedication).toHaveBeenCalledWith(1));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('단건 삭제가 실패하면 안내를 보여 준다', async () => {
    api.deleteGuardianMedication.mockRejectedValue(new Error('network'));
    api.getGuardianMedications.mockResolvedValue([]);
    const screen = renderCard([medication(1, { name: '혈압약' })]);

    await screen.getByRole('button', { name: '혈압약 삭제', exact: true }).click();
    await screen.getByRole('button', { name: '혈압약 삭제하기' }).click();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('삭제하지 못했어요');
  });

  it('삭제 확인은 Esc로 닫히고, 다른 시간대 칸을 눌러도 닫힌다 (점검 L-1)', async () => {
    const screen = renderCard([
      medication(1, { name: '혈압약', timeSlot: 'MORNING', doseTime: '08:00:00' }),
      medication(2, { name: '위장약', timeSlot: 'LUNCH', doseTime: '12:00:00' }),
    ]);
    const tiles = screen.getByRole('group', { name: '시간대 고르기' });

    await screen.getByRole('button', { name: '혈압약 삭제', exact: true }).click();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText('삭제해도 지난 복용 이력은 남아요').query()).toBeNull();
    await expect.element(screen.getByRole('button', { name: '혈압약 삭제', exact: true })).toHaveFocus();

    await screen.getByRole('button', { name: '혈압약 삭제', exact: true }).click();
    await tiles.getByRole('button', { name: /점심/ }).click();
    await tiles.getByRole('button', { name: /아침/ }).click();
    expect(screen.getByText('삭제해도 지난 복용 이력은 남아요').query()).toBeNull();
  });

  it('단건 삭제로 그 줄이 사라지면 시간대 제목으로 포커스를 옮긴다 (점검 L-2)', async () => {
    api.deleteGuardianMedication.mockResolvedValue({});
    api.getGuardianMedications.mockResolvedValue([]);
    const meds = [medication(1, { name: '혈압약' }), medication(2, { name: '위장약' })];
    const screen = renderCard(meds);

    await screen.getByRole('button', { name: '혈압약 삭제', exact: true }).click();
    await screen.getByRole('button', { name: '혈압약 삭제하기' }).click();
    await vi.waitFor(() => expect(api.deleteGuardianMedication).toHaveBeenCalledWith(1));
    // 다시 불러온 목록에서 그 약이 빠진 것처럼 다시 그린다
    screen.rerender(<WardMedicationCard summary={summary([meds[1]])} />);
    await expect.element(screen.getByRole('heading', { name: /아침 약/ })).toHaveFocus();
  });

  it('약이 둘 이상이면 전체 삭제 기능을 유지한다', async () => {
    api.deleteWardMedicationBatch.mockResolvedValue(2);
    api.getGuardianMedications.mockResolvedValue([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const screen = renderCard([medication(1), medication(2)]);

    // 고른 시간대 카드 밖에 두고 모든 시간대라고 밝힌다 (점검 M-2)
    const deleteAll = screen.getByRole('button', { name: '모든 시간대 약 전부 삭제' });
    expect(deleteAll.element().closest('section')).toBeNull();
    await deleteAll.click();
    await vi.waitFor(() => expect(api.deleteWardMedicationBatch).toHaveBeenCalledWith('W1', [1, 2]));
  });

  it('알림 시각을 정할 수 있고, 어르신 기기 알림용 가짜 스위치는 없다', async () => {
    api.updateMedicationAlertSetting.mockResolvedValue({});
    const screen = renderCard([medication(1)]);

    await expect.element(screen.getByRole('button', { name: /안 드시면 알림 받을 시각 오후 9:00/ })).toBeVisible();
    expect(screen.getByRole('checkbox').query()).toBeNull();
    await screen.getByRole('button', { name: /안 드시면 알림 받을 시각/ }).click();
    await screen.getByRole('group', { name: '시', exact: true }).getByRole('button', { name: '10', exact: true }).click();
    await screen.getByRole('group', { name: '분', exact: true }).getByRole('button', { name: '30', exact: true }).click();
    await screen.getByRole('button', { name: '오후 10:30로 정하기' }).click();
    await vi.waitFor(() =>
      expect(api.updateMedicationAlertSetting).toHaveBeenCalledWith('W1', {
        missedAlertEnabled: true,
        missedAlertTime: '22:30:00',
      }),
    );
  });

  it('알림 시각 저장이 실패하면 알린다 (점검 M-1)', async () => {
    api.updateMedicationAlertSetting.mockRejectedValue(new Error('network'));
    const screen = renderCard([medication(1)]);

    await screen.getByRole('button', { name: /안 드시면 알림 받을 시각/ }).click();
    await screen.getByRole('group', { name: '시', exact: true }).getByRole('button', { name: '10', exact: true }).click();
    await screen.getByRole('button', { name: '오후 10:00로 정하기' }).click();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('알림 시각을 저장하지 못했어요');
  });

  it('알림 시각 창은 Esc로 저장하지 않고 닫히고 포커스가 버튼으로 돌아온다 (점검 L-1)', async () => {
    const screen = renderCard([medication(1)]);
    const toggle = screen.getByRole('button', { name: /안 드시면 알림 받을 시각/ });

    await toggle.click();
    await screen.getByRole('group', { name: '시', exact: true }).getByRole('button', { name: '10', exact: true }).click();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('group', { name: '시', exact: true }).query()).toBeNull();
    await expect.element(toggle).toHaveFocus();
    expect(api.updateMedicationAlertSetting).not.toHaveBeenCalled();
  });

  it('등록된 약이 없어도 알림 시각 드롭다운은 항상 보여 준다', async () => {
    const screen = renderCard([]);

    await expect.element(screen.getByText('등록된 약이 없어요')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '첫 약 추가하기' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: /안 드시면 알림 받을 시각 오후 9:00/ })).toBeVisible();
  });

  it('환경설정에서 복약 알림이 꺼져 있으면 켜기 안내를 제공한다', async () => {
    notificationSetting.value = { medication: { enabled: false } };
    const screen = renderCard([medication(1)]);

    await expect.element(screen.getByText('지금 약 알림이 꺼져 있어요')).toBeVisible();
    await screen.getByRole('button', { name: '켜기' }).click();
    expect(navigation.push).toHaveBeenCalledWith('/guardian/settings');
  });
});
