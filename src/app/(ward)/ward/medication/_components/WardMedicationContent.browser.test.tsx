// 피보호자 복약 화면 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 2026-10-24 디자인: 시간대 하나만 크게 펼치고 나머지는 한 줄, 체크·되돌리기는 시간대 단위(BE #369 묶음 API)

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
function med(
  name: string,
  doseTime: string,
  timeSlot: MedicationItem['timeSlot'],
  taken = false,
  extra: Partial<MedicationItem> = {},
): MedicationItem {
  seq += 1;
  return { medicationId: seq, name, timeSlot, doseTime, doseAmount: 1, memo: null, taken, takenAt: null, createdAt: null, ...extra };
}

function today(medications: MedicationItem[]): TodayMedicationResponse {
  return {
    doseDate: '2026-10-23',
    takenCount: medications.filter(m => m.taken).length,
    totalCount: medications.length,
    medications,
  };
}

// 묶음 API 응답 - 요청한 약을 taken으로 바꿔 돌려준다
function batchReturns(all: MedicationItem[]) {
  api.setMedicationIntakeBatch.mockImplementation(async (ids: number[], taken: boolean) =>
    all.filter(m => ids.includes(m.medicationId)).map(m => ({ ...m, taken })),
  );
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

  it('지금 먹을 시간대만 펼치고 버튼 하나로 남은 약만 묶음 체크한다 - 체크하면 그 자리에서 되돌릴 수 있다', async () => {
    const names = ['코싹열정', '신일이부프로펜정', '알마겔정', '소말겐정', '엘도스캡슐', '코푸시럽'];
    const morning = names.map((name, i) => med(name, '08:00:00', 'MORNING', i === 0));
    const lunch = names.map(name => med(name, '12:00:00', 'LUNCH'));
    api.getTodayMedication.mockResolvedValue(today([...morning, ...lunch]));
    batchReturns([...morning, ...lunch]);
    const screen = renderContent();

    const morningCard = screen.getByRole('region', { name: '아침 약' });
    await expect.element(morningCard.getByText('지금 아침 약')).toBeVisible();
    await expect.element(morningCard.getByText('오전 8시')).toBeVisible();
    await expect.element(morningCard.getByText('신일이부프로펜정')).toBeVisible();
    // 점심은 한 줄(시각만), 약 이름은 보이지 않는다
    await expect.element(screen.getByRole('button', { name: /점심 약.*오후 12시/, expanded: false })).toBeVisible();
    expect(screen.getByRole('region', { name: '점심 약' }).getByText('알마겔정').query()).toBeNull();
    // 약마다 누르는 버튼은 없다(A안 - 시간대 단위)
    expect(screen.getByRole('button', { name: /코싹열정|알마겔정/ }).query()).toBeNull();

    // 1번은 이미 먹었으니 "남은 약"
    await screen.getByRole('button', { name: '남은 약 5개 먹었어요' }).click();
    await vi.waitFor(() => expect(api.setMedicationIntakeBatch).toHaveBeenCalledWith([2, 3, 4, 5, 6], true));
    expect(api.checkMedicationIntake).not.toHaveBeenCalled();

    await expect.element(screen.getByText('아침 약 다 먹었어요')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '아침 약 되돌리기' })).toBeVisible();
    // 375px에서 가로 넘침 없음
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('[되돌리기]는 그 시간대 체크를 묶음으로 푼다', async () => {
    const morning = [med('혈압약', '08:00:00', 'MORNING', true), med('위장약', '08:00:00', 'MORNING', true)];
    const dinner = [med('수면제', '19:00:00', 'DINNER')];
    api.getTodayMedication.mockResolvedValue(today([...morning, ...dinner]));
    batchReturns([...morning, ...dinner]);
    const screen = renderContent();

    // 지금은 저녁, 아침은 접힌 줄에 "먹었어요"
    await expect.element(screen.getByText('지금 저녁 약')).toBeVisible();
    await screen.getByRole('button', { name: /아침 약.*먹었어요/, expanded: false }).click();
    await screen.getByRole('button', { name: '아침 약 되돌리기' }).click();

    await vi.waitFor(() => expect(api.setMedicationIntakeBatch).toHaveBeenCalledWith([1, 2], false));
    expect(api.uncheckMedicationIntake).not.toHaveBeenCalled();
    // 풀리면 다시 체크할 수 있다 - 지금 먹을 시간대는 아침이지만 펼친 건 누른 아침 그대로
    await expect.element(screen.getByRole('button', { name: '아침 약 먹었어요' })).toBeVisible();
  });

  it('모두 먹었으면 맨 위에 "오늘 약 다 먹었어요"', async () => {
    api.getTodayMedication.mockResolvedValue(
      today([med('혈압약', '08:00:00', 'MORNING', true), med('수면제', '21:00:00', 'BEDTIME', true)]),
    );
    const screen = renderContent();

    await expect.element(screen.getByText('오늘 약 다 먹었어요')).toBeVisible();
    // 펼친 시간대는 없고 줄만 남는다 - 줄을 누르면 그 시간대를 펼쳐 되돌릴 수 있다
    expect(screen.getByText(/^지금/).query()).toBeNull();
    await screen.getByRole('button', { name: /취침 전 약/, expanded: false }).click();
    await expect.element(screen.getByRole('button', { name: '취침 전 약 되돌리기' })).toBeVisible();
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

    await screen.getByRole('button', { name: '아침 약 먹었어요' }).click();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('체크하지 못했어요');
    await vi.waitFor(() => expect(api.getTodayMedication).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(screen.getByText('위장약').query()).toBeNull());
    await screen.getByRole('button', { name: '아침 약 먹었어요' }).click();
    await vi.waitFor(() => expect(api.setMedicationIntakeBatch).toHaveBeenLastCalledWith([1], true));
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
  });

  it('빠르게 두 번 눌러도 요청은 한 번만 간다', async () => {
    const morning = [med('혈압약', '08:00:00', 'MORNING')];
    api.getTodayMedication.mockResolvedValue(today(morning));
    let resolve: (items: MedicationItem[]) => void = () => {};
    api.setMedicationIntakeBatch.mockReturnValue(new Promise(r => (resolve = r)));
    const screen = renderContent();

    const button = screen.getByRole('button', { name: '아침 약 먹었어요' });
    await expect.element(button).toBeVisible();
    const element = button.element() as HTMLButtonElement;
    element.click();
    element.click();
    await expect.element(button).toBeDisabled();
    expect(api.setMedicationIntakeBatch).toHaveBeenCalledTimes(1);
    resolve([{ ...morning[0], taken: true }]);
    await expect.element(screen.getByText('오늘 약 다 먹었어요').or(screen.getByText('아침 약 다 먹었어요'))).toBeVisible();
  });

  it('반 알은 "반 알", 메모도 보인다', async () => {
    api.getTodayMedication.mockResolvedValue(
      today([med('수면 보조제', '22:00:00', 'BEDTIME', false, { doseAmount: 0.5, memo: '식후 30분' })]),
    );
    const screen = renderContent();

    await expect.element(screen.getByText('반 알')).toBeVisible();
    await expect.element(screen.getByText('식후 30분')).toBeVisible();
    await expect.element(screen.getByText('오후 10시')).toBeVisible();
  });

  it('오늘 복용 시각이 지난 뒤 등록된 약은 그날 체크 대상이 아니다', async () => {
    const morning = [
      // 08:00 약을 10:00에 등록 - 오늘은 먹을 기회가 없었다
      med('혈압약', '08:00:00', 'MORNING', false, { createdAt: '2026-10-23T10:00:00+09:00' }),
      med('위장약', '08:00:00', 'MORNING'),
    ];
    const lunch = [med('소화제', '12:00:00', 'LUNCH', false, { createdAt: '2026-10-23T13:00:00+09:00' })];
    const dinner = [med('수면제', '19:00:00', 'DINNER', false, { createdAt: '2026-10-23T13:00:00+09:00' })];
    api.getTodayMedication.mockResolvedValue(today([...morning, ...lunch, ...dinner]));
    batchReturns([...morning, ...lunch, ...dinner]);
    const screen = renderContent();

    const morningCard = screen.getByRole('region', { name: '아침 약' });
    await expect.element(morningCard.getByText('오늘은 등록 전이었어요')).toBeVisible();
    // 남은 약이 1개뿐이라 "남은 약"이 아니라 시간대 버튼
    await screen.getByRole('button', { name: '아침 약 먹었어요' }).click();
    await vi.waitFor(() => expect(api.setMedicationIntakeBatch).toHaveBeenCalledWith([2], true));
    // 점심은 통째로 등록 전 - 다음 시간대는 점심을 건너뛰고 저녁(등록이 복용 시각보다 이르다)
    await expect.element(screen.getByRole('button', { name: /점심 약.*오늘은 등록 전/ })).toBeVisible();
    await screen.getByRole('button', { name: /점심 약/, expanded: false }).click();
    await expect.element(screen.getByText(/내일부터 드세요/)).toBeVisible();
    expect(screen.getByRole('button', { name: '점심 약 먹었어요' }).query()).toBeNull();
  });

  it('약 추가·수정·삭제 버튼은 없다 - 등록은 보호자 몫', async () => {
    api.getTodayMedication.mockResolvedValue(today([med('혈압약', '08:00:00', 'MORNING')]));
    const screen = renderContent();

    await expect.element(screen.getByText('지금 아침 약')).toBeVisible();
    expect(screen.getByRole('button', { name: /추가|수정|삭제|등록/ }).query()).toBeNull();
  });
});
