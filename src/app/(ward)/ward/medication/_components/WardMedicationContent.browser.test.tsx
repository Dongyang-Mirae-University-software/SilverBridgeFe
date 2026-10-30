// 피보호자 복약 목록 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`).
// Claude 디자인(2026-10-30): 위에 시간대 탭, 아래에 고른 시간대 카드. 같은 시각의 약을 함께 체크한다.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { kstToday } from '@/utils/reservation/reservationView';
import type { MedicationItem, TodayMedicationResponse } from '@/service/interface/medication';
import { WardMedicationContent } from './WardMedicationContent';

// 쿼리 모듈이 import하는 함수는 모두 둔다 - 빠지면 테스트 파일 import부터 깨진다
const api = vi.hoisted(() => ({
  getTodayMedication: vi.fn(),
  checkMedicationIntake: vi.fn(),
  uncheckMedicationIntake: vi.fn(),
  setMedicationIntakeBatch: vi.fn(),
}));

vi.mock('@/service/api/ward/medication', () => api);

let sequence = 0;

function medication(
  name: string,
  doseTime: string,
  timeSlot: MedicationItem['timeSlot'],
  taken = false,
  extra: Partial<MedicationItem> = {},
): MedicationItem {
  sequence += 1;
  return {
    medicationId: sequence,
    name,
    timeSlot,
    doseTime,
    doseAmount: 1,
    memo: null,
    taken,
    takenAt: null,
    createdAt: null,
    ...extra,
  };
}

function today(medications: MedicationItem[], doseDate = '2026-10-23'): TodayMedicationResponse {
  return {
    doseDate,
    takenCount: medications.filter(item => item.taken).length,
    totalCount: medications.length,
    medications,
  };
}

function setBatchResponse(all: MedicationItem[]) {
  api.setMedicationIntakeBatch.mockImplementation(async (ids: number[], taken: boolean) =>
    all.filter(item => ids.includes(item.medicationId)).map(item => ({ ...item, taken })),
  );
}

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function renderContent(queryClient = newQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<WardMedicationContent />, { wrapper });
}

describe('WardMedicationContent (Chrome)', () => {
  beforeEach(() => {
    sequence = 0;
    Object.values(api).forEach(mock => mock.mockReset());
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('현재 시간대 약을 크게 보여 주고, 해당 시간대의 약을 함께 체크한 뒤 그 시간대에 머문다', async () => {
    const dinner = medication('수면제', '19:00:00', 'DINNER');
    const morning = medication('혈압약', '08:00:00', 'MORNING');
    api.getTodayMedication.mockResolvedValue(today([dinner, morning]));
    setBatchResponse([dinner, morning]);
    const screen = renderContent();

    await expect.element(screen.getByText('지금 먹을 약')).toBeVisible();
    await expect.element(screen.getByText('혈압약')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '아침 지금' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByRole('button', { name: '저녁 오후 7시' })).toBeVisible();
    await screen.getByRole('button', { name: '아침 약 먹었어요' }).click();

    await vi.waitFor(() => expect(api.setMedicationIntakeBatch).toHaveBeenCalledWith([2], true));
    await expect.element(screen.getByText('다 먹었어요', { exact: true })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '아침 약 복용 체크 되돌리기' })).toHaveTextContent('잘못 눌렀어요');
    expect(screen.getByText('오늘 약 다 먹었어요').query()).toBeNull();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('먹은 약은 되돌릴 수 있고, 완료 안내는 체크 대상 약이 모두 먹었을 때만 보인다', async () => {
    const morning = medication('혈압약', '08:00:00', 'MORNING', true);
    api.getTodayMedication.mockResolvedValue(today([morning]));
    setBatchResponse([morning]);
    const screen = renderContent();

    await expect.element(screen.getByText('오늘 약 다 먹었어요')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '아침 먹었어요' })).toBeVisible();
    await screen.getByRole('button', { name: '아침 약 복용 체크 되돌리기' }).click();
    await vi.waitFor(() => expect(api.setMedicationIntakeBatch).toHaveBeenCalledWith([1], false));
    await expect.element(screen.getByRole('button', { name: '아침 약 먹었어요' })).toBeVisible();
    expect(screen.getByText('오늘 약 다 먹었어요').query()).toBeNull();
  });

  it('탭을 누르면 그 시간대 약을 보여 주고, 반 알은 "반 알"로 쓴다', async () => {
    const morning = medication('혈압약', '08:00:00', 'MORNING');
    const bedtime = medication('수면 보조제', '22:00:00', 'BEDTIME', false, { doseAmount: 0.5 });
    api.getTodayMedication.mockResolvedValue(today([morning, bedtime]));
    const screen = renderContent();

    await screen.getByRole('button', { name: '자기 전 오후 10시' }).click();
    await expect.element(screen.getByText('다음에 먹을 약')).toBeVisible();
    await expect.element(screen.getByText('반 알')).toBeVisible();
    expect(screen.getByText('0.5').query()).toBeNull();
    await expect.element(screen.getByRole('button', { name: '자기 전 약 먹었어요' })).toBeVisible();
  });

  it('복용 시각이 지났는데 체크하지 않은 시간대는 안 먹었다고 단정하지 않고 "체크 안 했어요"로 쓴다', async () => {
    const early = medication('혈압약', '00:00:00', 'MORNING');
    api.getTodayMedication.mockResolvedValue(today([early], kstToday()));
    const screen = renderContent();

    await expect.element(screen.getByRole('button', { name: '아침 체크 안 했어요' })).toBeVisible();
    // 시각이 지난 첫 시간대도 '지금 먹을 약'이라고 하지 않는다(기능 점검 F2)
    await expect.element(screen.getByText('체크되지 않은 약')).toBeVisible();
    expect(screen.getByText('지금 먹을 약').query()).toBeNull();
    expect(document.body.textContent).not.toContain('안 먹었');
  });

  it('약이 많으면 여러 칸으로 나눠 보여 주고 가로로 넘치지 않는다', async () => {
    const names = ['혈압약', '당뇨약', '위장약', '고지혈증약', '관절약', '비타민D'];
    api.getTodayMedication.mockResolvedValue(today(names.map(name => medication(name, '08:00:00', 'MORNING'))));
    const screen = renderContent();

    await expect.element(screen.getByText('고지혈증약')).toBeVisible();
    expect(screen.getByRole('listitem').all()).toHaveLength(6);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('오늘 복용 시각이 지난 뒤 등록된 약은 내일부터 안내하고 체크 버튼을 두지 않는다', async () => {
    api.getTodayMedication.mockResolvedValue(
      today([
        medication('혈압약', '08:00:00', 'MORNING', false, { createdAt: '2026-10-23T10:00:00+09:00' }),
      ]),
    );
    const screen = renderContent();

    await expect.element(screen.getByText('내일부터 드세요')).toBeVisible();
    expect(screen.getByRole('button', { name: '아침 약 먹었어요' }).query()).toBeNull();
    expect(screen.getByText('오늘 약 다 먹었어요').query()).toBeNull();
  });

  it('복용 체크가 실패하면 다시 불러오고 안내한다', async () => {
    const morning = medication('혈압약', '08:00:00', 'MORNING');
    api.getTodayMedication
      .mockResolvedValueOnce(today([morning]))
      .mockResolvedValue(today([morning]));
    api.setMedicationIntakeBatch.mockRejectedValueOnce(
      new AxiosError('복약 정보를 찾을 수 없습니다.', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 404,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {},
      }),
    );
    const screen = renderContent();

    await screen.getByRole('button', { name: '아침 약 먹었어요' }).click();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('체크하지 못했어요');
    await vi.waitFor(() => expect(api.getTodayMedication).toHaveBeenCalledTimes(2));
  });

  it('요청 중 빠르게 두 번 눌러도 한 번만 전송한다', async () => {
    const morning = medication('혈압약', '08:00:00', 'MORNING');
    api.getTodayMedication.mockResolvedValue(today([morning]));
    let resolveRequest: (items: MedicationItem[]) => void = () => {};
    api.setMedicationIntakeBatch.mockReturnValue(new Promise(resolve => (resolveRequest = resolve)));
    const screen = renderContent();

    const button = screen.getByRole('button', { name: '아침 약 먹었어요' });
    await expect.element(button).toBeEnabled();
    const element = button.element() as HTMLButtonElement;
    element.click();
    element.click();
    await expect.element(button).toBeDisabled();
    expect(api.setMedicationIntakeBatch).toHaveBeenCalledTimes(1);
    resolveRequest([{ ...morning, taken: true }]);
    await expect.element(screen.getByText('오늘 약 다 먹었어요')).toBeVisible();
  });
});
