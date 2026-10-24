// 보호자 병원 예약하기 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 디자인(2026-10-23 handoff): 목록 → 1. 병원 고르기 → 2. 날짜·시간 → 3. 확인 → 완료

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { IConnectionItem } from '@/service/interface/connection';
import type { IHospital, IReservationItem } from '@/service/interface/reservation';
import { addDays, formatDateShort, kstToday } from '@/utils/reservation/reservationView';
import { GuardianHospitalContent } from './GuardianHospitalContent';

const api = vi.hoisted(() => ({
  getHospitals: vi.fn(),
  getAvailableSlots: vi.fn(),
  getMyReservations: vi.fn(),
  createReservation: vi.fn(),
  cancelReservation: vi.fn(),
}));
const wards = vi.hoisted(() => ({ list: [] as unknown[] }));
const clock = vi.hoisted(() => ({ today: '2026-10-23', now: '00:00' }));

vi.mock('@/service/api/guardian/reservation', () => api);
vi.mock('@/utils/reservation/reservationView', async importOriginal => ({
  ...(await importOriginal<typeof import('@/utils/reservation/reservationView')>()),
  kstToday: () => clock.today,
  kstNowTime: () => clock.now,
}));
vi.mock('@/hooks/useActiveConnections', () => ({
  useGuardianActiveWards: () => ({ activeWards: wards.list, hasActiveWards: wards.list.length > 0, isLoading: false }),
}));
vi.mock('@/service/query/user', () => ({
  myProfileQueryOptions: {
    queryKey: ['test-me'],
    queryFn: async () => ({ data: { name: '박보호', phone: '010-9999-8888' } }),
  },
}));

const TODAY = kstToday();
const TOMORROW = addDays(TODAY, 1);

function ward(id: string, name: string, phone: string | null = '010-1234-5678'): IConnectionItem {
  return {
    id: 1,
    partnerUserId: id,
    partnerName: name,
    partnerProfileImage: null,
    partnerPhone: phone,
    status: 'ACTIVE',
    connectedAt: null,
    createdAt: '',
  };
}

function hospital(
  id: number,
  name: string,
  departments: string[],
  operationStatus: IHospital['operationStatus'] = 'OPEN',
): IHospital {
  return {
    id,
    name,
    region: '서울',
    address: `서울 강남구 ${name}로 ${id}`,
    phone: '02-000-0000',
    departments,
    operationStatus,
    congestionLevel: 'LOW',
    bookingAvailable: true,
    description: '',
    openTime: '09:00',
    closeTime: '12:00',
  };
}

function reservation(
  id: number,
  date: string,
  time: string,
  status: IReservationItem['status'] = 'BOOKED',
  hospitalName = '강남내과',
): IReservationItem {
  return {
    reservationId: id,
    hospitalName,
    department: '내과',
    reservationDate: date,
    reservationTime: time,
    status,
    symptomSummary: '',
    createdAt: '',
  };
}

function axiosError(status: number, message = 'server text') {
  const error = new AxiosError(message);
  error.response = { status, data: {}, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
  return error;
}

// 진행 막대의 단계(li) - 현재 단계에 aria-current="step"
function step(screen: ReturnType<typeof renderContent>, label: string) {
  return screen.getByRole('list', { name: '예약 단계' }).getByRole('listitem').filter({ hasText: label });
}

function renderContent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<GuardianHospitalContent />, { wrapper });
}

describe('GuardianHospitalContent (Chrome)', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset());
    clock.now = '00:00';
    wards.list = [ward('ward01', '김영희')];
    api.getHospitals.mockResolvedValue([hospital(1, '강남내과', ['내과', '가정의학과']), hospital(2, '푸른안과', ['안과'])]);
    api.getMyReservations.mockResolvedValue([]);
    // 09:00~11:30 중 10:00만 찼다
    api.getAvailableSlots.mockResolvedValue(['09:00', '09:30', '10:30', '11:00', '11:30']);
    api.createReservation.mockResolvedValue({ data: { success: true } });
    api.cancelReservation.mockResolvedValue({ data: { success: true } });
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('새 진료 예약 - 병원 고르기 → 날짜·시간 → 확인 → 완료, 증상 없이 피보호자 번호로 예약한다', async () => {
    const screen = renderContent();

    await expect.element(screen.getByText('예정된 진료가 없어요')).toBeVisible();
    // 피보호자가 한 명이면 선택 칸이 없다
    expect(screen.getByRole('combobox').elements()).toHaveLength(0);
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();

    await expect.element(step(screen, '1. 병원 고르기')).toHaveAttribute('aria-current', 'step');
    await screen.getByRole('searchbox', { name: '병원 찾기' }).fill('가정');
    await expect.element(screen.getByRole('button', { name: /강남내과 · 가정의학과/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /푸른안과/ }).elements()).toHaveLength(0);
    await screen.getByRole('button', { name: /강남내과 · 가정의학과/ }).click();

    await expect.element(step(screen, '2. 날짜·시간')).toHaveAttribute('aria-current', 'step');
    await expect.element(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    await screen.getByRole('button', { name: formatDateShort(TOMORROW) }).click();
    await expect.element(screen.getByRole('button', { name: '오전 10시 마감' })).toBeDisabled();
    await screen.getByRole('button', { name: '오전 9시', exact: true }).click();
    // 375px(테스트 화면 폭)에서 가로로 넘치지 않는다
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await screen.getByRole('button', { name: '다음' }).click();

    await expect.element(screen.getByText('이대로 예약할까요?')).toBeVisible();
    await expect.element(screen.getByText('진료받으실 분: 김영희 님')).toBeVisible();
    // 피보호자 번호가 있으면 번호 칸을 띄우지 않는다
    expect(screen.getByRole('textbox').elements()).toHaveLength(0);
    await screen.getByRole('button', { name: '예약하기' }).click();

    await expect.element(screen.getByText('예약했어요')).toBeVisible();
    await expect.element(screen.getByText('김영희 님 화면에서도 볼 수 있어요')).toBeVisible();
    expect(api.getAvailableSlots).toHaveBeenCalledWith(1, TOMORROW);
    expect(api.createReservation).toHaveBeenCalledTimes(1);
    const [wardId, body] = api.createReservation.mock.calls[0];
    expect(wardId).toBe('ward01');
    expect(body).toMatchObject({
      hospitalId: 1,
      department: '가정의학과',
      reservationDate: TOMORROW,
      reservationTime: '09:00',
      patientName: '김영희',
      phone: '010-1234-5678',
      guardianName: '박보호',
    });
    expect(body).not.toHaveProperty('symptomSummary');

    await screen.getByRole('button', { name: '확인' }).click();
    await expect.element(screen.getByRole('button', { name: '새 진료 예약하기' })).toBeVisible();
  });

  it('예약 중 [예약 취소]를 누르면 입력을 지우고 목록으로 돌아간다', async () => {
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /푸른안과 · 안과/ }).click();
    await screen.getByRole('button', { name: '예약 취소' }).click();

    await expect.element(screen.getByRole('button', { name: '새 진료 예약하기' })).toBeVisible();
    expect(screen.getByRole('list', { name: '예약 단계' }).elements()).toHaveLength(0);
  });

  it('피보호자 번호가 없으면 확인 단계에서 번호를 받아야 예약할 수 있다', async () => {
    wards.list = [ward('ward01', '김영희', null)];
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /푸른안과/ }).click();
    await screen.getByRole('button', { name: formatDateShort(TOMORROW) }).click();
    await screen.getByRole('button', { name: '오전 9시', exact: true }).click();
    await screen.getByRole('button', { name: '다음' }).click();

    await expect.element(screen.getByRole('button', { name: '예약하기' })).toBeDisabled();
    await screen.getByRole('textbox', { name: /병원 연락을 받을 번호/ }).fill('010-5555-6666');
    await screen.getByRole('button', { name: '예약하기' }).click();

    await vi.waitFor(() => expect(api.createReservation).toHaveBeenCalledTimes(1));
    expect(api.createReservation.mock.calls[0][1].phone).toBe('010-5555-6666');
  });

  it('이미 찬 시간(409)이면 서버 문구를 보여 주고 확인 단계에 머문다', async () => {
    api.createReservation.mockRejectedValue(axiosError(409, '이미 예약된 시간입니다.'));
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /푸른안과/ }).click();
    await screen.getByRole('button', { name: formatDateShort(TOMORROW) }).click();
    await screen.getByRole('button', { name: '오전 9시', exact: true }).click();
    await screen.getByRole('button', { name: '다음' }).click();
    await screen.getByRole('button', { name: '예약하기' }).click();

    await expect.element(screen.getByRole('alert')).toHaveTextContent('이미 예약된 시간입니다.');
    await expect.element(screen.getByText('이대로 예약할까요?')).toBeVisible();
  });

  it('다음 진료 카드에서 예약을 취소한다(한 번 더 묻는다)', async () => {
    api.getMyReservations.mockResolvedValue([reservation(7, TOMORROW, '10:00')]);
    const screen = renderContent();

    await expect.element(screen.getByText('1일 남음')).toBeVisible();
    await expect.element(screen.getByText(`${formatDateShort(TOMORROW)} 오전 10시`)).toBeVisible();
    await screen.getByRole('button', { name: /강남내과 예약 취소$/ }).click();
    await expect.element(screen.getByText('이 예약을 취소할까요?')).toBeVisible();
    await screen.getByRole('button', { name: '예약 취소하기' }).click();

    await expect.element(screen.getByText('예약을 취소했어요.')).toBeVisible();
    expect(api.cancelReservation).toHaveBeenCalledWith('ward01', 7);
  });

  it('다가오는 예약이 둘 이상이면 나머지는 "그 밖의 예약", 지난 진료는 [같은 곳 다시 예약]으로 날짜 단계로 간다', async () => {
    api.getMyReservations.mockResolvedValue([
      reservation(1, addDays(TODAY, 3), '10:00'),
      reservation(2, TOMORROW, '09:00'),
      reservation(3, addDays(TODAY, -5), '10:00', 'COMPLETED'),
      reservation(4, addDays(TODAY, -9), '10:00', 'COMPLETED', '사라진병원'),
    ]);
    const screen = renderContent();

    await expect.element(screen.getByRole('region', { name: '그 밖의 예약' })).toHaveTextContent(
      formatDateShort(addDays(TODAY, 3)),
    );
    const past = screen.getByRole('region', { name: '지난 진료' });
    // 병원 목록에 없는 병원은 다시 예약 버튼이 없다
    expect(past.getByRole('button', { name: /다시 예약$/ }).elements()).toHaveLength(1);
    await past.getByRole('button', { name: '강남내과 내과 다시 예약' }).click();

    await expect.element(step(screen, '2. 날짜·시간')).toHaveAttribute('aria-current', 'step');
    await expect.element(screen.getByText('강남내과', { exact: false })).toBeVisible();
  });

  it('병원 목록은 5곳씩 나눠 보여 준다', async () => {
    api.getHospitals.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => hospital(i + 1, `병원${i + 1}`, ['내과'])),
    );
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();

    await expect.element(screen.getByRole('button', { name: /병원5 · 내과/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /병원6/ }).elements()).toHaveLength(0);
    await screen.getByRole('navigation', { name: '병원 목록 페이지' }).getByRole('button', { name: '2페이지' }).click();
    await expect.element(screen.getByRole('button', { name: /병원7 · 내과/ })).toBeVisible();
  });

  it('찾는 병원이 없으면 안내한다', async () => {
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('searchbox', { name: '병원 찾기' }).fill('없는이름');
    await expect.element(screen.getByText('찾는 병원이 없어요')).toBeVisible();
  });

  it.each([
    [401, '로그인이 끝났어요. 다시 로그인해 주세요.'],
    [403, '연결된 피보호자의 예약만 볼 수 있어요.'],
    [503, '지금은 병원 예약 서비스를 쓸 수 없어요. 잠시 뒤 다시 시도해 주세요.'],
    [502, '예약 서비스에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'],
  ])('예약을 못 불러오면 상태(%i)별 문구를 보여 준다', async (status, text) => {
    api.getMyReservations.mockRejectedValue(axiosError(status));
    const screen = renderContent();
    await expect.element(screen.getByRole('alert')).toHaveTextContent(text);
    await expect.element(screen.getByRole('button', { name: '다시 불러오기' })).toBeVisible();
  });

  it('피보호자가 두 명 이상이면 선택 칸이 보이고 바꾸면 그 사람의 예약을 부른다', async () => {
    wards.list = [ward('ward01', '김영희'), ward('ward02', '이철수')];
    const screen = renderContent();

    await screen.getByRole('combobox', { name: '진료받으실 분' }).selectOptions('ward02');
    await vi.waitFor(() => expect(api.getMyReservations).toHaveBeenCalledWith('ward02'));
  });

  it('연결된 피보호자가 없으면 안내만 한다', async () => {
    wards.list = [];
    const screen = renderContent();
    await expect.element(screen.getByText(/연결된 피보호자가 없어요/)).toBeVisible();
    expect(api.getMyReservations).not.toHaveBeenCalled();
  });

  it('M-3 예약하는 중에는 [예약 취소]·[이전]이 잠기고, 끝나면 보낸 병원 이름으로 완료를 보여 준다', async () => {
    let finish: (value: unknown) => void = () => {};
    api.createReservation.mockReturnValue(new Promise(resolve => (finish = resolve)));
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /푸른안과/ }).click();
    await screen.getByRole('button', { name: formatDateShort(TOMORROW) }).click();
    await screen.getByRole('button', { name: '오전 9시', exact: true }).click();
    await screen.getByRole('button', { name: '다음' }).click();
    await screen.getByRole('button', { name: '예약하기' }).click();

    await expect.element(screen.getByRole('button', { name: '예약하는 중' })).toBeDisabled();
    await expect.element(screen.getByRole('button', { name: '예약 취소' })).toBeDisabled();
    await expect.element(screen.getByRole('button', { name: '이전' })).toBeDisabled();

    finish({ data: { success: true } });
    await expect.element(screen.getByText('예약했어요')).toHaveFocus();
    await expect.element(screen.getByText('푸른안과 · 안과')).toBeVisible();
  });

  it('M-4 지금 진료 중이 아닌 병원은 흐리게 "지금은 예약을 받지 않아요"이고 누를 수 없다', async () => {
    api.getHospitals.mockResolvedValue([hospital(1, '강남내과', ['내과'], 'HOLIDAY'), hospital(2, '푸른안과', ['안과'])]);
    api.getMyReservations.mockResolvedValue([reservation(3, addDays(TODAY, -5), '10:00', 'COMPLETED')]);
    const screen = renderContent();

    // 지난 진료의 휴진 병원은 [같은 곳 다시 예약]을 두지 않는다
    await expect.element(screen.getByRole('region', { name: '지난 진료' })).toHaveTextContent('강남내과');
    expect(screen.getByRole('button', { name: /다시 예약$/ }).elements()).toHaveLength(0);

    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    const closed = screen.getByRole('button', { name: /강남내과 · 내과/ });
    await expect.element(closed).toBeDisabled();
    await expect.element(closed).toHaveTextContent('지금은 예약을 받지 않아요');
    await expect.element(screen.getByRole('button', { name: /푸른안과 · 안과/ })).toBeEnabled();
  });

  it('L-6 고른 시각이 그사이 지나면 [다음]에서 날짜·시간 단계에 머물고 다시 고르게 한다', async () => {
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /푸른안과/ }).click();
    await screen.getByRole('button', { name: `${formatDateShort(TODAY)} 오늘` }).click();
    await screen.getByRole('button', { name: '오전 9시', exact: true }).click();

    clock.now = '09:10';
    await screen.getByRole('button', { name: '다음' }).click();

    await expect.element(screen.getByRole('alert')).toHaveTextContent('고르신 시간이 이미 지났어요.');
    await expect.element(step(screen, '2. 날짜·시간')).toHaveAttribute('aria-current', 'step');
    await expect.element(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(api.createReservation).not.toHaveBeenCalled();
  });

  it('L-6 확인 단계에서 [예약하기]를 누를 때 시각이 지났으면 보내지 않는다', async () => {
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /푸른안과/ }).click();
    await screen.getByRole('button', { name: `${formatDateShort(TODAY)} 오늘` }).click();
    await screen.getByRole('button', { name: '오전 9시', exact: true }).click();
    await screen.getByRole('button', { name: '다음' }).click();

    clock.now = '09:00';
    await screen.getByRole('button', { name: '예약하기' }).click();

    await expect.element(screen.getByRole('alert')).toHaveTextContent('고르신 시간이 이미 지났어요.');
    expect(api.createReservation).not.toHaveBeenCalled();
  });

  it('L-5 번호 형식이 틀리면 이유를 글로 알려 준다', async () => {
    wards.list = [ward('ward01', '김영희', null)];
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /푸른안과/ }).click();
    await screen.getByRole('button', { name: formatDateShort(TOMORROW) }).click();
    await screen.getByRole('button', { name: '오전 9시', exact: true }).click();
    await screen.getByRole('button', { name: '다음' }).click();
    await screen.getByRole('textbox', { name: /병원 연락을 받을 번호/ }).fill('12345');

    await expect.element(screen.getByText('010-1234-5678처럼 휴대폰 번호를 적어 주세요.')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '예약하기' })).toBeDisabled();
  });

  it('L-5 예약 취소를 누르면 확인의 [아니요]로 포커스가 간다', async () => {
    api.getMyReservations.mockResolvedValue([reservation(7, TOMORROW, '10:00')]);
    const screen = renderContent();
    await screen.getByRole('button', { name: /강남내과 예약 취소$/ }).click();
    await expect.element(screen.getByRole('button', { name: '아니요' })).toHaveFocus();
  });
});
