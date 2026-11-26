// 보호자 복약 카드 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`).
// Claude Design(2026-10-30): 위에 시간대 칸, 아래에 고른 시간대의 약. 삭제는 그 줄 안에서 확인한다.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Fragment, ReactNode, useEffect } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

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

// 모달은 전역 스토어라 테스트가 중간에 실패하면 열린 창이 다음 테스트로 남는다 - 렌더할 때 비운다(2026-11-20 FE #294 점검 L-2)
function ModalOutlet() {
  const modals = useModalStore(state => state.modals);
  const resetModal = useModalStore(state => state.resetModal);
  useEffect(() => resetModal(), [resetModal]);
  return modals.map(modal => <Fragment key={modal.id}>{modal.Component}</Fragment>);
}

async function renderCard(medications: MedicationItem[]) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const screen = await render(<WardMedicationCard summary={summary(medications)} />, { wrapper });
  await render(<ModalOutlet />, { wrapper });
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
    const screen = await renderCard([
      medication(2, { name: '수면제', timeSlot: 'BEDTIME', doseTime: '22:00:00', doseAmount: 0.5 }),
      medication(1, { name: '혈압약', timeSlot: 'MORNING', doseTime: '08:00:00', taken: true }),
    ]);

    const tiles = screen.getByRole('group', { name: '시간대 고르기' });
    await expect.element(tiles.getByRole('button', { name: /아침/ })).toMatchTextContent('✓ 드셨어요');
    // 끝나지 않은 첫 시간대가 기본으로 골라지고 "다음"으로 표시된다
    await expect.element(tiles.getByRole('button', { name: /취침 전/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tiles.getByRole('button', { name: /취침 전/ })).toMatchTextContent('다음');
    await expect.element(screen.getByRole('list', { name: '취침 전 약 목록' })).toMatchTextContent('수면제반 알');

    await tiles.getByRole('button', { name: /아침/ }).click();
    await expect.element(screen.getByRole('heading', { name: /아침 약/ })).toMatchTextContent('오전 8:00');
    await expect.element(screen.getByRole('list', { name: '아침 약 목록' })).toMatchTextContent('혈압약');
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('시간대 칸은 시각과 상관없이 아침·점심·저녁·취침 전 순서다 (2026-10-30 gosky)', async () => {
    const screen = await renderCard([
      medication(1, { name: '감기약', timeSlot: 'LUNCH', doseTime: '01:40:00' }),
      medication(2, { name: '혈압약', timeSlot: 'MORNING', doseTime: '08:00:00' }),
      medication(3, { name: '수면제', timeSlot: 'BEDTIME', doseTime: '00:30:00' }),
    ]);

    const tiles = screen.getByRole('group', { name: '시간대 고르기' }).getByRole('button');
    await expect.element(tiles.first()).toMatchTextContent('아침');
    expect(tiles.elements().map(tile => tile.textContent?.slice(0, 2))).toEqual(['아침', '점심', '취침']);
  });

  it('지난 시간대는 "안 드셨어요"로 단정하지 않고, 오늘 늦게 등록한 약은 등록 전으로 보여 준다', async () => {
    const screen = await renderCard([
      medication(1, { name: '혈압약', timeSlot: 'MORNING', doseTime: '06:00:00' }),
      medication(2, { name: '위장약', timeSlot: 'LUNCH', doseTime: '06:30:00', createdAt: `${TODAY}T06:50:00+09:00` }),
    ]);

    const tiles = screen.getByRole('group', { name: '시간대 고르기' });
    await expect.element(tiles.getByRole('button', { name: /아침/ })).toMatchTextContent('체크되지 않았어요');
    await expect.element(tiles.getByRole('button', { name: /점심/ })).toMatchTextContent('등록 전');
    await tiles.getByRole('button', { name: /점심/ }).click();
    await expect.element(screen.getByText('오늘은 등록 전이었어요')).toBeVisible();
    expect(document.body.textContent).not.toContain('안 드셨어요');
  });

  it('체크되지 않은 시간대는 요약 문장과 시간대 칸에만 알리고 제목 옆 배지로 다시 말하지 않는다 (2026-11-20)', async () => {
    const screen = await renderCard([
      medication(1, { name: '혈압약', timeSlot: 'MORNING', doseTime: '06:00:00' }),
      medication(2, { name: '비타민', timeSlot: 'DINNER', doseTime: '18:00:00' }),
    ]);

    await expect.element(screen.getByText('아침 약이 아직 체크되지 않았어요')).toBeVisible();
    const tiles = screen.getByRole('group', { name: '시간대 고르기' });
    await expect.element(tiles.getByRole('button', { name: /아침/ })).toMatchTextContent('체크되지 않았어요');
    // 처음 고른 시간대가 체크되지 않은 아침이어도 제목 옆 배지는 없다 - 요약 1곳 + 칸 1곳
    await expect.element(screen.getByRole('heading', { name: /아침 약/ })).toBeVisible();
    expect(document.body.textContent?.match(/체크되지 않았어요/g)).toHaveLength(2);
    expect(document.querySelector('[class*="slotStatus"]')).toBeNull();

    // 다른 상태 배지는 그대로 보인다
    await tiles.getByRole('button', { name: /저녁/ }).click();
    await expect.element(screen.getByRole('heading', { name: /저녁 약/ })).toBeVisible();
    expect(document.querySelector('[class*="slotStatus"]')?.textContent).toBe('예정');
  });

  it('약 이름은 BE 짧은 이름(displayName)으로 보이고, 수정 창 입력값은 원래 이름이다', async () => {
    const original = '다이아벡스정500밀리그램(메트포르민염산염)';
    const screen = await renderCard([medication(1, { name: original, displayName: '다이아벡스정' })]);

    const name = screen.getByText('다이아벡스정', { exact: true });
    await expect.element(name).toBeVisible();
    expect(name.element().getAttribute('title')).toBe(original);
    expect(screen.getByText(original).query()).toBeNull();

    // 수정 창에 짧은 이름을 넣고 저장하면 원본이 사라진다 - 입력값은 원래 이름
    await screen.getByRole('button', { name: '다이아벡스정 수정' }).click();
    const dialog = screen.getByRole('dialog', { name: '약 수정' });
    await expect.element(dialog.getByRole('textbox', { name: '약 이름' })).toHaveValue(original);
    await dialog.getByRole('button', { name: '닫기' }).click();
    await expect.element(dialog).not.toBeInTheDocument();
  });

  it('긴 약 이름은 줄을 바꿔 그 줄 안에 담고 가로로 넘치지 않는다 (FE #294 점검 L-3)', async () => {
    const longName = '신일이부프로펜에이스연질캡슐아세트아미노펜복합제';
    const screen = await renderCard([medication(1, { name: `${longName}400mg`, displayName: longName })]);

    const name = screen.getByText(longName, { exact: true });
    await expect.element(name).toBeVisible();
    const nameElement = name.element() as HTMLElement;
    const row = nameElement.closest('li') as HTMLElement;
    const style = getComputedStyle(nameElement);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    expect(nameElement.getBoundingClientRect().height).toBeGreaterThan(lineHeight * 1.5);
    expect(nameElement.getBoundingClientRect().right).toBeLessThanOrEqual(row.getBoundingClientRect().right + 0.5);
    await expect.element(screen.getByRole('button', { name: `${longName} 수정` })).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('수정 버튼은 늘 보이고, 삭제는 그 줄 안에서 확인한 뒤 지운다', async () => {
    api.deleteGuardianMedication.mockResolvedValue({});
    api.getGuardianMedications.mockResolvedValue([]);
    const confirm = vi.spyOn(window, 'confirm');
    const screen = await renderCard([medication(1, { name: '혈압약' })]);

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
    const screen = await renderCard([medication(1, { name: '혈압약' })]);

    await screen.getByRole('button', { name: '혈압약 삭제', exact: true }).click();
    await screen.getByRole('button', { name: '혈압약 삭제하기' }).click();
    await expect.element(screen.getByRole('alert')).toMatchTextContent('삭제하지 못했어요');
  });

  it('삭제 확인은 Esc로 닫히고, 다른 시간대 칸을 눌러도 닫힌다 (점검 L-1)', async () => {
    const screen = await renderCard([
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
    const screen = await renderCard(meds);

    await screen.getByRole('button', { name: '혈압약 삭제', exact: true }).click();
    await screen.getByRole('button', { name: '혈압약 삭제하기' }).click();
    await vi.waitFor(() => expect(api.deleteGuardianMedication).toHaveBeenCalledWith(1));
    // 다시 불러온 목록에서 그 약이 빠진 것처럼 다시 그린다
    await screen.rerender(<WardMedicationCard summary={summary([meds[1]])} />);
    await expect.element(screen.getByRole('heading', { name: /아침 약/ })).toHaveFocus();
  });

  it('약이 둘 이상이면 전체 삭제 기능을 유지한다 - 앱 안 확인 창에서 [삭제]를 눌러야 지운다 (2026-11-26)', async () => {
    api.deleteWardMedicationBatch.mockResolvedValue(2);
    api.getGuardianMedications.mockResolvedValue([]);
    const confirm = vi.spyOn(window, 'confirm');
    const screen = await renderCard([medication(1), medication(2)]);

    // 고른 시간대 카드 밖에 두고 모든 시간대라고 밝힌다 (점검 M-2)
    const deleteAll = screen.getByRole('button', { name: '모든 시간대 약 전부 삭제' });
    expect(deleteAll.element().closest('section')).toBeNull();

    // [취소]면 지우지 않는다
    await deleteAll.click();
    await screen.getByRole('alertdialog').getByRole('button', { name: '취소' }).click();
    expect(api.deleteWardMedicationBatch).not.toHaveBeenCalled();

    await deleteAll.click();
    await expect.element(screen.getByRole('alertdialog')).toBeVisible();
    expect(screen.getByRole('alertdialog').element().textContent).toContain('지난 복용 이력은 남습니다.');
    await screen.getByRole('alertdialog').getByRole('button', { name: '삭제' }).click();
    await vi.waitFor(() => expect(api.deleteWardMedicationBatch).toHaveBeenCalledWith('W1', [1, 2]));
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('알림 시각을 정할 수 있고, 어르신 기기 알림용 가짜 스위치는 없다', async () => {
    api.updateMedicationAlertSetting.mockResolvedValue({});
    const screen = await renderCard([medication(1)]);

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
    const screen = await renderCard([medication(1)]);

    await screen.getByRole('button', { name: /안 드시면 알림 받을 시각/ }).click();
    await screen.getByRole('group', { name: '시', exact: true }).getByRole('button', { name: '10', exact: true }).click();
    await screen.getByRole('button', { name: '오후 10:00로 정하기' }).click();
    await expect.element(screen.getByRole('alert')).toMatchTextContent('알림 시각을 저장하지 못했어요');
  });

  it('알림 시각 창은 Esc로 저장하지 않고 닫히고 포커스가 버튼으로 돌아온다 (점검 L-1)', async () => {
    const screen = await renderCard([medication(1)]);
    const toggle = screen.getByRole('button', { name: /안 드시면 알림 받을 시각/ });

    await toggle.click();
    await screen.getByRole('group', { name: '시', exact: true }).getByRole('button', { name: '10', exact: true }).click();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('group', { name: '시', exact: true }).query()).toBeNull();
    await expect.element(toggle).toHaveFocus();
    expect(api.updateMedicationAlertSetting).not.toHaveBeenCalled();
  });

  it('등록된 약이 없어도 알림 시각 드롭다운은 항상 보여 준다', async () => {
    const screen = await renderCard([]);

    await expect.element(screen.getByText('등록된 약이 없어요')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '첫 약 추가하기' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: /안 드시면 알림 받을 시각 오후 9:00/ })).toBeVisible();
  });

  it('환경설정에서 복약 알림이 꺼져 있으면 켜기 안내를 제공한다', async () => {
    notificationSetting.value = { medication: { enabled: false } };
    const screen = await renderCard([medication(1)]);

    await expect.element(screen.getByText('지금 약 알림이 꺼져 있어요')).toBeVisible();
    await screen.getByRole('button', { name: '켜기' }).click();
    expect(navigation.push).toHaveBeenCalledWith('/guardian/settings');
  });
});
