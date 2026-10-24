// 피보호자 복약 화면 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 같은 시간대 약은 한 묶음, "아침 약 다 먹었어요" 한 번으로 체크(2026-10-23, BE #369 묶음 체크 API)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { MedicationItem, TodayMedicationResponse } from '@/service/interface/medication';
import { WardMedicationContent } from './WardMedicationContent';

const api = vi.hoisted(() => ({
  getTodayMedication: vi.fn(),
  checkMedicationIntake: vi.fn(),
  uncheckMedicationIntake: vi.fn(),
  setMedicationIntakeBatch: vi.fn(),
}));

vi.mock('@/service/api/ward/medication', () => api);

let seq = 0;
function med(name: string, doseTime: string, timeSlot: MedicationItem['timeSlot'], taken = false): MedicationItem {
  seq += 1;
  return { medicationId: seq, name, timeSlot, doseTime, doseAmount: 1, memo: null, taken, takenAt: null, createdAt: null };
}

function today(medications: MedicationItem[]): TodayMedicationResponse {
  return {
    doseDate: '2026-10-23',
    takenCount: medications.filter(m => m.taken).length,
    totalCount: medications.length,
    medications,
  };
}

function renderContent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<WardMedicationContent />, { wrapper });
}

describe('WardMedicationContent (Chrome)', () => {
  beforeEach(() => {
    seq = 0;
    Object.values(api).forEach(fn => fn.mockReset());
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('아침 약 6개는 한 묶음 - "아침 약 다 먹었어요" 한 번으로 아직 안 먹은 약만 묶음 체크한다', async () => {
    const names = ['코싹열정', '신일이부프로펜정', '알마겔정', '소말겐정', '엘도스캡슐', '코푸시럽'];
    const morning = names.map((name, i) => med(name, '08:00:00', 'MORNING', i === 0));
    const lunch = names.map(name => med(name, '12:00:00', 'LUNCH'));
    api.getTodayMedication.mockResolvedValue(today([...morning, ...lunch]));
    api.setMedicationIntakeBatch.mockImplementation(async (ids: number[]) =>
      [...morning, ...lunch].filter(m => ids.includes(m.medicationId)).map(m => ({ ...m, taken: true })),
    );
    const screen = renderContent();

    await expect.element(screen.getByText('다음에 드실 약 · 아침 08:00')).toBeVisible();
    // 일부를 먹었으니 "남은 약"(점검 L-1)
    await expect.element(screen.getByText('남은 약 5개')).toBeVisible();
    // 묶음 머리 버튼도 시간대가 이름에 들어간다(점검 L-2)
    await expect
      .element(screen.getByRole('region', { name: '점심 약' }).getByRole('button', { name: '점심 약 다 먹었어요' }))
      .toBeVisible();
    await expect.element(screen.getByRole('region', { name: '아침 약' })).toBeVisible();
    await expect.element(screen.getByRole('region', { name: '점심 약' })).toBeVisible();

    await screen.getByRole('button', { name: '아침 약 다 먹었어요' }).first().click();

    await vi.waitFor(() => expect(api.setMedicationIntakeBatch).toHaveBeenCalledTimes(1));
    // 이미 먹은 1번은 빼고 나머지 5개만, 단건 API는 부르지 않는다
    expect(api.setMedicationIntakeBatch).toHaveBeenCalledWith([2, 3, 4, 5, 6], true);
    expect(api.checkMedicationIntake).not.toHaveBeenCalled();
    // 아침이 끝나면 다음은 점심, 아침 묶음은 "다 드셨어요"
    await expect.element(screen.getByText('다음에 드실 약 · 점심 12:00')).toBeVisible();
    await expect.element(screen.getByRole('region', { name: '아침 약' }).getByText('다 드셨어요')).toBeVisible();
    // 375px에서 가로 넘침 없음
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('묶음 체크가 실패하면(그 사이 지워진 약) 일정을 다시 불러오고 안내한다 - 다시 누르면 된다 (점검 M-1)', async () => {
    const morning = [med('혈압약', '08:00:00', 'MORNING'), med('위장약', '08:00:00', 'MORNING')];
    api.getTodayMedication
      .mockResolvedValueOnce(today(morning))
      .mockResolvedValue(today([morning[0]])); // 보호자가 위장약을 지웠다
    api.setMedicationIntakeBatch
      .mockRejectedValueOnce(
        new AxiosError('복약 정보를 찾을 수 없습니다.', 'ERR_BAD_REQUEST', undefined, undefined, {
          status: 404,
          statusText: '',
          headers: {},
          config: { headers: new AxiosHeaders() },
          data: {},
        }),
      )
      .mockResolvedValueOnce([{ ...morning[0], taken: true }]);
    const screen = renderContent();

    await screen.getByRole('button', { name: '아침 약 다 먹었어요' }).first().click();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('체크하지 못했어요');
    await vi.waitFor(() => expect(api.getTodayMedication).toHaveBeenCalledTimes(2));
    // 다시 불러온 목록에는 혈압약만 - 이제 [먹었어요]로 체크된다
    await expect.element(screen.getByText('혈압약 1정')).toBeVisible();
    await screen.getByRole('button', { name: '먹었어요', exact: true }).click();
    await vi.waitFor(() => expect(api.setMedicationIntakeBatch).toHaveBeenLastCalledWith([1], true));
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
  });

  it('잘못 누른 약 하나는 그 약의 버튼으로 푼다(단건 API) - "전체 풀기" 버튼은 없다', async () => {
    const morning = [med('혈압약', '08:00:00', 'MORNING', true), med('위장약', '08:00:00', 'MORNING', true)];
    api.getTodayMedication.mockResolvedValue(today(morning));
    api.uncheckMedicationIntake.mockResolvedValue({ ...morning[0], taken: false });
    const screen = renderContent();

    await expect.element(screen.getByText('오늘 약을 모두 드셨어요')).toBeVisible();
    expect(screen.getByRole('button', { name: /다 먹었어요|모두 풀기|전체 풀기/ }).query()).toBeNull();

    // 다 먹은 시간대는 접혀 있다 - 머리를 눌러 펼친 뒤 하나를 푼다
    expect(screen.getByRole('button', { name: '혈압약 먹었어요' }).query()).toBeNull();
    await screen.getByRole('button', { name: /아침/, expanded: false }).click();
    await screen.getByRole('button', { name: '혈압약 먹었어요' }).click();
    await vi.waitFor(() => expect(api.uncheckMedicationIntake).toHaveBeenCalledWith(1));
    expect(api.setMedicationIntakeBatch).not.toHaveBeenCalled();
    await expect.element(screen.getByRole('button', { name: '혈압약 안 먹었어요' })).toBeVisible();
  });

  it('지금 먹을 시간대 하나만 펼치고, 다 먹은·나중 시간대는 머리만 - 누르면 펼친다 (2026-10-24)', async () => {
    const morning = [med('혈압약', '08:00:00', 'MORNING', true), med('위장약', '08:00:00', 'MORNING', true)];
    const lunch = [med('소화제', '12:00:00', 'LUNCH'), med('진통제', '12:00:00', 'LUNCH')];
    const dinner = [med('수면제', '19:00:00', 'DINNER'), med('비타민', '19:00:00', 'DINNER')];
    api.getTodayMedication.mockResolvedValue(today([...morning, ...lunch, ...dinner]));
    const screen = renderContent();

    await expect.element(screen.getByText('다음에 드실 약 · 점심 12:00')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '소화제 안 먹었어요' })).toBeVisible();
    expect(screen.getByRole('button', { name: '혈압약 먹었어요' }).query()).toBeNull();
    expect(screen.getByRole('button', { name: '수면제 안 먹었어요' }).query()).toBeNull();
    // 지금 시간대 머리에는 [다 먹었어요]가 없다(위 카드에 있다), 나중 시간대 머리에는 있다
    expect(screen.getByRole('button', { name: '점심 약 다 먹었어요' }).elements()).toHaveLength(1);
    await expect.element(screen.getByRole('button', { name: '저녁 약 다 먹었어요' })).toBeVisible();

    await screen.getByRole('button', { name: /저녁/, expanded: false }).click();
    await expect.element(screen.getByRole('button', { name: '수면제 안 먹었어요' })).toBeVisible();
    await screen.getByRole('button', { name: /점심/, expanded: true }).click();
    expect(screen.getByRole('button', { name: '소화제 안 먹었어요' }).query()).toBeNull();
  });

  it('약이 하나뿐인 시간대는 이름을 그대로 보이고 버튼은 "먹었어요"', async () => {
    api.getTodayMedication.mockResolvedValue(today([med('혈압약', '21:00:00', 'BEDTIME')]));
    api.setMedicationIntakeBatch.mockResolvedValue([]);
    const screen = renderContent();

    await expect.element(screen.getByText('혈압약 1정')).toBeVisible();
    await screen.getByRole('button', { name: '먹었어요', exact: true }).click();
    await vi.waitFor(() => expect(api.setMedicationIntakeBatch).toHaveBeenCalledWith([1], true));
    // 묶음 머리에는 약 1개짜리 [다 먹었어요]를 두지 않는다(줄의 버튼과 겹친다)
    expect(screen.getByRole('button', { name: '다 먹었어요', exact: true }).query()).toBeNull();
  });
});
