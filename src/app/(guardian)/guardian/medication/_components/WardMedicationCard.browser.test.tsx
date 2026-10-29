// 보호자 복약 카드 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`).
// v13: 약마다 시간·이름·상태·삭제 버튼을 한 줄에 표시한다.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Fragment, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

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
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
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

  it('시간순으로 약마다 시간·이름·상태·휴지통 삭제를 보여 준다', async () => {
    const screen = renderCard([
      medication(2, { name: '수면제', timeSlot: 'BEDTIME', doseTime: '22:00:00', doseAmount: 0.5 }),
      medication(1, { name: '혈압약', timeSlot: 'MORNING', doseTime: '08:00:00', taken: true }),
    ]);

    await expect.element(screen.getByRole('list', { name: '오늘 드실 약' })).toBeVisible();
    await expect.element(screen.getByText('아침 08:00')).toBeVisible();
    await expect.element(screen.getByText('혈압약')).toBeVisible();
    await expect.element(screen.getByText('드셨어요')).toBeVisible();
    await expect.element(screen.getByText('취침 전 22:00')).toBeVisible();
    await expect.element(screen.getByText('반 알')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '혈압약 삭제' })).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('약 이름을 누르면 기존 수정 모달을 열고, 삭제는 즉시 확인한다', async () => {
    api.deleteGuardianMedication.mockResolvedValue({});
    api.getGuardianMedications.mockResolvedValue([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const screen = renderCard([medication(1, { name: '혈압약' })]);

    await screen.getByRole('button', { name: '혈압약 수정' }).click();
    await expect.element(screen.getByRole('dialog', { name: '약 수정' })).toBeVisible();
    await screen.getByRole('dialog', { name: '약 수정' }).getByRole('button', { name: '닫기' }).click();
    await screen.getByRole('button', { name: '혈압약 삭제' }).click();
    await vi.waitFor(() => expect(api.deleteGuardianMedication).toHaveBeenCalledWith(1));
  });

  it('단건 삭제가 실패하면 안내를 보여 준다', async () => {
    api.deleteGuardianMedication.mockRejectedValue(new Error('network'));
    api.getGuardianMedications.mockResolvedValue([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const screen = renderCard([medication(1, { name: '혈압약' })]);

    await screen.getByRole('button', { name: '혈압약 삭제' }).click();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('삭제하지 못했어요');
  });

  it('약이 둘 이상이면 전체 삭제 기능을 유지한다', async () => {
    api.deleteWardMedicationBatch.mockResolvedValue(2);
    api.getGuardianMedications.mockResolvedValue([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const screen = renderCard([medication(1), medication(2)]);

    await screen.getByRole('button', { name: '약 전부 삭제' }).click();
    await vi.waitFor(() => expect(api.deleteWardMedicationBatch).toHaveBeenCalledWith('W1', [1, 2]));
  });

  it('알림 시각을 정할 수 있고, 어르신 기기 알림용 가짜 스위치는 없다', async () => {
    api.updateMedicationAlertSetting.mockResolvedValue({});
    const screen = renderCard([medication(1)]);

    await expect.element(screen.getByRole('button', { name: /안 드시면 알림 받을 시각 오후 9:00/ })).toBeVisible();
    expect(screen.getByRole('checkbox').query()).toBeNull();
    await screen.getByRole('button', { name: /안 드시면 알림 받을 시각/ }).click();
    await screen.getByRole('group', { name: '시' }).getByRole('button', { name: '10', exact: true }).click();
    await screen.getByRole('group', { name: '분' }).getByRole('button', { name: '30', exact: true }).click();
    await screen.getByRole('button', { name: '오후 10:30로 정하기' }).click();
    await vi.waitFor(() =>
      expect(api.updateMedicationAlertSetting).toHaveBeenCalledWith('W1', {
        missedAlertEnabled: true,
        missedAlertTime: '22:30:00',
      }),
    );
  });

  it('환경설정에서 복약 알림이 꺼져 있으면 켜기 안내를 제공한다', async () => {
    notificationSetting.value = { medication: { enabled: false } };
    const screen = renderCard([medication(1)]);

    await expect.element(screen.getByText('지금 복약 알림을 받지 않고 있어요')).toBeVisible();
    await screen.getByRole('button', { name: '켜기' }).click();
    expect(navigation.push).toHaveBeenCalledWith('/guardian/settings');
  });
});
