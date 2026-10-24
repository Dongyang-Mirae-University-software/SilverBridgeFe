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
  updateMedicationAlertSetting: vi.fn(),
}));

vi.mock('@/service/api/guardian/medication', async importOriginal => ({
  ...(await importOriginal<object>()),
  deleteWardMedicationBatch: api.deleteWardMedicationBatch,
  deleteGuardianMedication: api.deleteGuardianMedication,
  getGuardianMedications: api.getGuardianMedications,
  updateMedicationAlertSetting: api.updateMedicationAlertSetting,
}));

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }) }));

// 보호자 알림 종류 설정(환경설정) - 테스트마다 "복약 알림 꺼짐"을 바꿔 본다
const notificationSetting = vi.hoisted(() => ({ value: null as null | { medication: { enabled: boolean } } }));
vi.mock('@/service/query/guardian/notification', () => ({
  guardianNotificationTypeSettingQueryOptions: {
    queryKey: ['guardian-notification-type-test'],
    queryFn: () => notificationSetting.value,
  },
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

function renderCard(medications: MedicationItem[], container?: HTMLElement) {
  const summary: WardMedicationSummary = {
    wardId: 'W1',
    wardName: '김순자',
    age: 80,
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
  return render(<WardMedicationCard summary={summary} />, { wrapper, container });
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
    // 두 약은 같은 아침 묶음 - 등록 전이었던 약은 묶음 판정에서 빠지고, 맨 위는 시간대로 한 문장(2026-10-24)
    await expect.element(screen.getByText('아침 약이 아직 체크되지 않았어요')).toBeVisible();
    expect(screen.getByText(/번 중/).query()).toBeNull();
    // 체크 전인 아침이 다음 차례라 처음부터 펼쳐져 있다(Claude Design 2026-10-24)
    await expect.element(screen.getByRole('button', { name: /아침/, expanded: true })).toBeVisible();
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

    // "N번 중"이 아니라 지난 마지막 시간대로 한 문장, 앞 시간대에 남은 것은 아래 줄(2026-10-24)
    await expect.element(screen.getByText('저녁 약이 아직 체크되지 않았어요')).toBeVisible();
    await expect.element(screen.getByText('점심 약도 아직 체크되지 않았어요')).toBeVisible();
    expect(screen.getByText(/번 중/).query()).toBeNull();
    // 시간대 줄: "아침 │ 오전 12:00 · 6가지 │ 상태" - 시간대 이름표 줄은 없앴다(Claude Design 2026-10-24)
    expect(screen.getByRole('list', { name: '시간대별 상태' }).query()).toBeNull();
    await expect.element(screen.getByRole('button', { name: /아침/ })).toHaveTextContent('6가지');
    await expect.element(screen.getByRole('button', { name: /아침/ }).getByText('다 드셨어요')).toBeVisible();
    await expect.element(screen.getByText('6개 중 5개 드셨어요')).toBeVisible();
    await expect.element(screen.getByText('아직 체크 전이에요')).toBeVisible();

    // 처음에는 다음 차례(체크 전인 첫 시간대 = 점심)만 펼쳐져 있다. 다 드신 아침은 접혀 있다
    await expect.element(screen.getByRole('button', { name: /아침/ })).toHaveAttribute('aria-expanded', 'false');
    await expect.element(screen.getByRole('button', { name: /점심/, expanded: true })).toBeVisible();
    // 펼쳐 보기만 할 때는 수정·삭제가 없다 - [약 고치기]를 눌러야 나온다
    expect(screen.getByRole('button', { name: '코싹열정 삭제' }).query()).toBeNull();
    expect(screen.getByRole('button', { name: /수정$/ }).query()).toBeNull();
    await screen.getByRole('button', { name: '약 고치기' }).click();
    expect(screen.getByRole('button', { name: '코싹열정 삭제' }).elements()).toHaveLength(1);
    await expect.element(screen.getByRole('button', { name: '신일이부프로펜정400mg 수정' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '다 고쳤어요' })).toBeVisible();
    // 펼친 약은 시간대 줄과 다른 상태만 배지를 단다 - 점심의 안 드신 코푸시럽은 줄 상태("6개 중 5개")와 같은 "체크 전"이라 없고,
    // "아직 체크 전이에요"는 저녁 줄 하나뿐(2026-10-24)
    expect(screen.getByText('아직 체크 전이에요').elements()).toHaveLength(1);

    // 한 번에 한 시간대만 - 저녁을 펼치면 점심은 접히고 고치기 모드도 풀린다
    await screen.getByRole('button', { name: /저녁/ }).click();
    await expect.element(screen.getByRole('button', { name: /저녁/, expanded: true })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: /점심/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '코싹열정 삭제' }).query()).toBeNull();
    // 375px에서 가로 넘침 없음
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('체크한 약이 없고 체크할 약도 없으면 "모두 드셨어요"라고 하지 않는다 (점검 L-2)', async () => {
    const screen = renderCard([med(1, { createdAt: `${TODAY}T00:30:00+09:00` })]);
    await expect.element(screen.getByText('오늘은 체크할 약이 없어요')).toBeVisible();
    expect(screen.getByText('오늘 약을 모두 드셨어요').query()).toBeNull();
  });

  it('체크한 약이 있고 지난 약이 없으면 "모두 드셨어요"', async () => {
    const screen = renderCard([med(1, { taken: true }), med(2, { createdAt: `${TODAY}T00:30:00+09:00` })]);
    await expect.element(screen.getByText('오늘 약을 모두 드셨어요')).toBeVisible();
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
    await screen.getByRole('button', { name: '약 고치기' }).click();
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

    // 시안에 없는 기능이라 고치기 모드에서만 보인다
    expect(screen.getByRole('button', { name: '약 전부 삭제' }).query()).toBeNull();
    await screen.getByRole('button', { name: '약 고치기' }).click();
    await screen.getByRole('button', { name: '약 전부 삭제' }).click();
    expect(confirm).toHaveBeenCalledWith('김순자의 약 6개를 모두 삭제할까요? 지난 복용 이력은 남습니다.');
    await vi.waitFor(() => expect(api.deleteWardMedicationBatch).toHaveBeenCalledWith('W1', [1, 2, 3, 4, 5, 6]));
    await expect.element(screen.getByRole('alert')).toHaveTextContent('삭제하지 못했어요');
  });

  it('약이 하나뿐이면 묶음 삭제·전부 삭제 버튼을 두지 않는다(단건 삭제로 충분)', async () => {
    const screen = renderCard([med(1, { name: '혈압약' })]);
    await screen.getByRole('button', { name: '약 고치기' }).click();
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

    await screen.getByRole('button', { name: '약 고치기' }).click();
    await screen.getByRole('button', { name: '혈압약 삭제' }).click();

    await vi.waitFor(() => expect(api.deleteGuardianMedication).toHaveBeenCalledWith(1));
    await expect.element(screen.getByRole('alert')).toHaveTextContent('삭제하지 못했어요');
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled());
  });
  it('알림 설정: 시간 버튼은 읽을 이름이 있고, 어르신 기기 알림을 끄는 스위치는 없다 (2026-10-24, BE #377 늘 보냄)', async () => {
    const screen = renderCard([med(1)]);
    await expect.element(screen.getByRole('button', { name: /안 드시면 알림 받을 시각 오후 9:00/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox').query()).toBeNull();
    expect(screen.getByText(/약 드실 시간 알려 드리기/).query()).toBeNull();
    // 시각이 곧 집계 상한이라는 뜻을 짧게 알린다
    await expect.element(screen.getByText('이 시각까지 체크되지 않은 약을 알려 드려요')).toBeVisible();
    await expect.element(screen.getByText('나에게 오는 알림을 켜고 끄는 건 환경설정에서 해요')).toBeVisible();
  });

  it('보호자 화면에는 복용 체크 버튼이 없고, "안 드셨어요"로 단정하지 않는다', async () => {
    const screen = renderCard([med(1, { name: '혈압약' }), med(2, { name: '위장약', taken: true })]);
    await expect.element(screen.getByRole('button', { name: /아침/, expanded: true })).toBeVisible();
    await screen.getByRole('button', { name: '약 고치기' }).click();
    const buttons = screen.getByRole('button').elements().map(element => element.textContent ?? '');
    expect(buttons.some(text => /드셨어요|먹었어요|체크하기/.test(text) && !/^아침/.test(text))).toBe(false);
    expect(document.body.textContent).not.toMatch(/안 드셨/);
  });

  it('시간 고르기: 오전/오후·시·분을 고르고 "○○로 정하기"를 눌러야 저장한다(시각과 함께 이 피보호자 요약도 켠다)', async () => {
    api.updateMedicationAlertSetting.mockResolvedValue({});
    const screen = renderCard([med(1)]);
    await screen.getByRole('button', { name: /안 드시면 알림 받을 시각/ }).click();
    await screen.getByRole('group', { name: '시' }).getByRole('button', { name: '10', exact: true }).click();
    await screen.getByRole('group', { name: '분' }).getByRole('button', { name: '30', exact: true }).click();
    expect(api.updateMedicationAlertSetting).not.toHaveBeenCalled();
    await screen.getByRole('button', { name: '오후 10:30로 정하기' }).click();
    await vi.waitFor(() =>
      expect(api.updateMedicationAlertSetting).toHaveBeenCalledWith('W1', {
        missedAlertTime: '22:30:00',
        missedAlertEnabled: true,
      }),
    );
  });

  it('나에게 오는 복약 알림이 꺼져 있으면 노란 상자와 [켜기] - 누르면 환경설정으로', async () => {
    notificationSetting.value = { medication: { enabled: false } };
    const screen = renderCard([med(1)]);
    await expect.element(screen.getByText('지금 복약 알림을 받지 않고 있어요')).toBeVisible();
    await screen.getByRole('button', { name: '켜기' }).click();
    expect(nav.push).toHaveBeenCalledWith('/guardian/settings');
    notificationSetting.value = null;
  });

  // 숨긴 토글 input이 기준을 잃으면 안쪽 스크롤 상자가 아니라 문서 기준으로 놓여
  // 바깥 문서가 늘고 화면 아래에 빈 띠가 생긴다 (FE #114)
  it('position 없는 안쪽 스크롤 상자에 넣어도 바깥 문서를 늘리지 않는다 (2026-10-24 점검 L-1)', async () => {
    const scroller = document.createElement('div');
    scroller.style.height = '200px';
    scroller.style.overflowY = 'auto';
    // 카드 위를 비워 토글이 화면 아래(접힌 곳)에 놓이게 한다
    const spacer = document.createElement('div');
    spacer.style.height = `${window.innerHeight + 200}px`;
    const slot = document.createElement('div');
    scroller.append(spacer, slot);
    document.body.appendChild(scroller);
    const screen = renderCard([med(1)], slot);
    // 스위치가 없어져 알림 설정 카드의 시간 버튼으로 본다(숨김 입력·절대 위치 요소가 문서를 늘리지 않는지)
    const toggle = screen.getByRole('button', { name: /안 드시면 알림 받을 시각/ });
    await expect.element(toggle).toBeInTheDocument();

    expect(toggle.element().getBoundingClientRect().top).toBeGreaterThan(window.innerHeight);
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight);
  });
});
