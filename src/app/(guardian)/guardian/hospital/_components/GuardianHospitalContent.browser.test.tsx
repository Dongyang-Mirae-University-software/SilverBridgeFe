// 보호자 병원 예약하기 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 디자인(Claude 디자인 2026-10-30): 목록 → 1. 병원 고르기 → 2. 진료과·날짜·시간 → 3. 확인 → 완료

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import { RESERVATION_DEMO_NOTICE } from '@/constants/reservation';
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

function axiosError(status: number, message = 'server text', code?: string) {
  const error = new AxiosError(message);
  error.response = { status, data: { code }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
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

    await expect.element(screen.getByText('잡혀 있는 예약이 없어요')).toBeVisible();
    await expect.element(screen.getByRole('heading', { name: '예약 현황 0건' })).toBeVisible();
    // 피보호자가 한 명이면 선택 칸이 없다
    expect(screen.getByRole('combobox').elements()).toHaveLength(0);
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();

    await expect.element(step(screen, '1. 병원 고르기')).toHaveAttribute('aria-current', 'step');
    await expect.element(screen.getByText(RESERVATION_DEMO_NOTICE)).toBeVisible();
    await screen.getByRole('searchbox', { name: '병원 찾기' }).fill('가정');
    // 병원 한 줄에 진료과 목록이 함께 보인다
    await expect.element(screen.getByRole('button', { name: /강남내과 내과 · 가정의학과/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /푸른안과/ }).elements()).toHaveLength(0);
    await screen.getByRole('button', { name: /강남내과/ }).click();

    await expect.element(step(screen, '2. 날짜·시간')).toHaveAttribute('aria-current', 'step');
    await expect.element(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    // 진료과가 여럿이면 진료과부터 고른다 - 고르기 전엔 시간 칸을 묻지 않는다
    await screen.getByRole('button', { name: formatDateShort(TOMORROW) }).click();
    await expect.element(screen.getByText('진료과를 먼저 골라 주세요.')).toBeVisible();
    expect(api.getAvailableSlots).not.toHaveBeenCalled();
    await screen.getByRole('region', { name: '진료과' }).getByRole('button', { name: '가정의학과' }).click();
    await expect.element(screen.getByRole('button', { name: '오전 10시 마감' })).toBeDisabled();
    await screen.getByRole('button', { name: '오전 9시', exact: true }).click();
    // 375px(테스트 화면 폭)에서 가로로 넘치지 않는다
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await screen.getByRole('button', { name: '다음' }).click();

    await expect.element(screen.getByText('이대로 예약할까요?')).toBeVisible();
    // 2026-10-30 디자인: 주소·진료받으실 분·연락처를 함께 보여 준다
    await expect.element(screen.getByText('서울 강남구 강남내과로 1')).toBeVisible();
    await expect.element(screen.getByText('진료받으실 분')).toBeVisible();
    await expect.element(screen.getByText('010-1234-5678')).toBeVisible();
    await expect.element(screen.getByText(RESERVATION_DEMO_NOTICE)).toBeVisible();
    // 피보호자 번호가 있으면 번호 칸 대신 [바꾸기]만 둔다
    expect(screen.getByRole('textbox', { name: '연락처' }).elements()).toHaveLength(0);
    await expect.element(screen.getByRole('button', { name: '연락처 바꾸기' })).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await screen.getByRole('button', { name: '예약하기' }).click();

    await expect.element(screen.getByText('예약했어요')).toBeVisible();
    await expect.element(screen.getByText('김영희 화면에서도 볼 수 있어요')).toBeVisible();
    await expect.element(screen.getByText(RESERVATION_DEMO_NOTICE)).toBeVisible();
    // 시간 칸은 진료과별 - 고른 진료과로 빈 시간을 묻는다
    expect(api.getAvailableSlots).toHaveBeenCalledWith(1, TOMORROW, '가정의학과');
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

  it('휴진 요일 날짜는 누를 수 없고 "휴진"으로 보이며, 점심시간 칸은 그리지 않는다', async () => {
    const [y, m, d] = TOMORROW.split('-').map(Number);
    const tomorrowWeekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    api.getHospitals.mockResolvedValue([
      { ...hospital(1, '강남내과', ['내과']), breakStart: '10:00', breakEnd: '10:30', closedWeekdays: [tomorrowWeekday] },
    ]);
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /강남내과/ }).click();

    const closedDay = screen.getByRole('button', { name: `${formatDateShort(TOMORROW)} 휴진` });
    await expect.element(closedDay).toBeDisabled();
    await expect.element(closedDay).toHaveTextContent('휴진');

    const nextDay = addDays(TODAY, 2);
    await screen.getByRole('button', { name: formatDateShort(nextDay) }).click();
    await expect.element(screen.getByRole('button', { name: '오전 9시', exact: true })).toBeVisible();
    expect(screen.getByRole('button', { name: /오전 10시$|오전 10시 마감/ }).elements()).toHaveLength(0);
    await expect.element(screen.getByRole('button', { name: '오전 10시 30분', exact: true })).toBeVisible();
  });

  it('요일별 진료 시간이 있는 날은 그 시간까지만 칸을 그린다(예: 반일)', async () => {
    const [y, m, d] = TOMORROW.split('-').map(Number);
    const tomorrowWeekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    api.getHospitals.mockResolvedValue([
      { ...hospital(1, '강남내과', ['내과']), weekdayHours: [{ weekday: tomorrowWeekday, openTime: '09:00', closeTime: '10:30' }] },
    ]);
    api.getAvailableSlots.mockResolvedValue(['09:00', '09:30', '10:00']);
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /강남내과/ }).click();
    await screen.getByRole('button', { name: formatDateShort(TOMORROW) }).click();
    await expect.element(screen.getByRole('button', { name: '오전 10시', exact: true })).toBeVisible();
    expect(screen.getByRole('button', { name: /오전 10시 30분|오전 11시/ }).elements()).toHaveLength(0);
  });

  it('예약 중 [예약 취소]를 누르면 입력을 지우고 목록으로 돌아간다', async () => {
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /푸른안과/ }).click();
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
    await screen.getByRole('textbox', { name: '연락처' }).fill('010-5555-6666');
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

  it('다음 진료 카드에서 예약을 취소한다(확인 창으로 한 번 더 묻는다)', async () => {
    api.getMyReservations.mockResolvedValue([reservation(7, TOMORROW, '10:00')]);
    const screen = renderContent();

    const next = screen.getByRole('group', { name: '다음 진료' });
    await expect.element(next.getByText('내일')).toBeVisible();
    await expect.element(next).toHaveTextContent(`${formatDateShort(TOMORROW)} 오전 10시`);
    await screen.getByRole('button', { name: /강남내과 예약 취소$/ }).click();
    const dialog = screen.getByRole('dialog', { name: '이 예약을 취소할까요?' });
    // 취소해도 피보호자에게 알림은 가지 않는다 - 사실대로 "화면에서도 보인다"고만 안내한다
    await expect.element(dialog).toHaveTextContent('김영희 님 화면에서도 취소된 것으로 보여요');
    await dialog.getByRole('button', { name: '예약 취소' }).click();

    await expect.element(screen.getByText('예약을 취소했어요.')).toBeVisible();
    expect(api.cancelReservation).toHaveBeenCalledWith('ward01', 7);
    expect(screen.getByRole('dialog').elements()).toHaveLength(0);
  });

  it('다가오는 예약이 둘 이상이면 나머지는 아래 줄로, 지난 진료 카드의 [다시 예약]은 날짜 단계로 간다', async () => {
    api.getMyReservations.mockResolvedValue([
      reservation(1, addDays(TODAY, 3), '10:00'),
      reservation(2, TOMORROW, '09:00'),
      reservation(3, addDays(TODAY, -5), '10:00', 'COMPLETED'),
      reservation(4, addDays(TODAY, -9), '10:00', 'COMPLETED', '사라진병원'),
    ]);
    const screen = renderContent();

    await expect.element(screen.getByRole('heading', { name: '예약 현황 2건' })).toBeVisible();
    const more = screen.getByRole('group', { name: '그 밖의 예약' });
    await expect.element(more).toHaveTextContent(formatDateShort(addDays(TODAY, 3)));
    await expect.element(more).toHaveTextContent('3일 뒤');
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

    await expect.element(screen.getByRole('button', { name: /병원5/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /병원6/ }).elements()).toHaveLength(0);
    await screen.getByRole('navigation', { name: '병원 목록 페이지' }).getByRole('button', { name: '2페이지' }).click();
    await expect.element(screen.getByRole('button', { name: /병원7/ })).toBeVisible();
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

    // 지난 진료의 휴진 병원은 [다시 예약]을 두지 않는다
    await expect.element(screen.getByRole('region', { name: '지난 진료' })).toHaveTextContent('강남내과');
    expect(screen.getByRole('button', { name: /다시 예약$/ }).elements()).toHaveLength(0);

    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    const closed = screen.getByRole('button', { name: /강남내과/ });
    await expect.element(closed).toBeDisabled();
    await expect.element(closed).toHaveTextContent('지금은 예약을 받지 않아요');
    await expect.element(screen.getByRole('button', { name: /푸른안과/ })).toBeEnabled();
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
    await screen.getByRole('textbox', { name: '연락처' }).fill('12345');

    await expect.element(screen.getByText('010-1234-5678처럼 휴대폰 번호를 적어 주세요.')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '예약하기' })).toBeDisabled();
  });

  it('L-5 예약 취소를 누르면 확인 창의 [그대로 두기]로 포커스가 가고, Esc로 닫으면 누른 버튼으로 돌아온다', async () => {
    api.getMyReservations.mockResolvedValue([reservation(7, TOMORROW, '10:00')]);
    const screen = renderContent();
    const opener = screen.getByRole('button', { name: /강남내과 예약 취소$/ });
    await opener.click();
    await expect.element(screen.getByRole('button', { name: '그대로 두기' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog').elements()).toHaveLength(0);
    await expect.element(opener).toHaveFocus();
    expect(api.cancelReservation).not.toHaveBeenCalled();
  });

  it('증상을 적으면 symptomSummary로 함께 보낸다(앞뒤 공백 제거, 200자까지)', async () => {
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /푸른안과/ }).click();
    await screen.getByRole('button', { name: formatDateShort(TOMORROW) }).click();
    await screen.getByRole('button', { name: '오전 9시', exact: true }).click();
    await screen.getByRole('button', { name: '다음' }).click();

    const symptom = screen.getByRole('textbox', { name: /어디가 불편하세요/ });
    await expect.element(symptom).toHaveAttribute('maxlength', '200');
    await symptom.fill('  며칠 전부터 눈이 침침해요 ');
    await screen.getByRole('button', { name: '예약하기' }).click();

    await vi.waitFor(() => expect(api.createReservation).toHaveBeenCalledTimes(1));
    expect(api.createReservation.mock.calls[0][1].symptomSummary).toBe('며칠 전부터 눈이 침침해요');
  });

  it('[바꾸기]로 연락처를 고치면 고친 번호로 예약하고, 줄표는 자동으로 넣는다', async () => {
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /푸른안과/ }).click();
    await screen.getByRole('button', { name: formatDateShort(TOMORROW) }).click();
    await screen.getByRole('button', { name: '오전 9시', exact: true }).click();
    await screen.getByRole('button', { name: '다음' }).click();

    await screen.getByRole('button', { name: '연락처 바꾸기' }).click();
    const phone = screen.getByRole('textbox', { name: '연락처' });
    await expect.element(phone).toHaveValue('010-1234-5678');
    await phone.fill('01077778888');
    await expect.element(phone).toHaveValue('010-7777-8888');
    await screen.getByRole('button', { name: '예약하기' }).click();

    await vi.waitFor(() => expect(api.createReservation).toHaveBeenCalledTimes(1));
    expect(api.createReservation.mock.calls[0][1].phone).toBe('010-7777-8888');
  });

  it('같은 시간에 이미 예약이 있으면(DUPLICATE_RESERVATION) 누구의 예약인지 넣어 안내한다', async () => {
    api.createReservation.mockRejectedValue(axiosError(400, '동일 시간대에 이미 예약이 있습니다.', 'DUPLICATE_RESERVATION'));
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await screen.getByRole('button', { name: /푸른안과/ }).click();
    await screen.getByRole('button', { name: formatDateShort(TOMORROW) }).click();
    await screen.getByRole('button', { name: '오전 9시', exact: true }).click();
    await screen.getByRole('button', { name: '다음' }).click();
    await screen.getByRole('button', { name: '예약하기' }).click();

    await expect.element(screen.getByRole('alert')).toHaveTextContent('김영희 님은 이 시간에 이미 예약이 있어요.');
    await expect.element(screen.getByText('이대로 예약할까요?')).toBeVisible();
  });

  it('지난 진료 카드에 취소·거절·미방문 상태를 작게 보여 준다', async () => {
    api.getMyReservations.mockResolvedValue([
      reservation(1, addDays(TODAY, -2), '10:00', 'CANCELED'),
      reservation(2, addDays(TODAY, -3), '10:00', 'REJECTED'),
      reservation(3, addDays(TODAY, -4), '10:00', 'NO_SHOW'),
      reservation(4, addDays(TODAY, -5), '10:00', 'COMPLETED'),
    ]);
    const screen = renderContent();
    const past = screen.getByRole('region', { name: '지난 진료' });
    await expect.element(past.getByText('취소됨')).toBeVisible();
    await expect.element(past.getByText('병원이 거절함')).toBeVisible();
    await expect.element(past.getByText('방문하지 않음')).toBeVisible();
    await expect.element(screen.getByRole('heading', { name: '예약 현황 0건' })).toBeVisible();
  });

  it('예약 접수를 멈춘 병원(bookingAvailable=false)은 병원 목록에 두지 않는다', async () => {
    api.getHospitals.mockResolvedValue([
      { ...hospital(1, '강남내과', ['내과']), bookingAvailable: false },
      hospital(2, '푸른안과', ['안과']),
    ]);
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await expect.element(screen.getByRole('button', { name: /푸른안과/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /강남내과/ }).elements()).toHaveLength(0);
  });

  it('진료과가 넷 이상이면 병원 줄에 셋까지만 적고 "외 N개"로 줄인다', async () => {
    api.getHospitals.mockResolvedValue([hospital(1, '종합병원', ['내과', '외과', '안과', '치과', '피부과'])]);
    const screen = renderContent();
    await screen.getByRole('button', { name: '새 진료 예약하기' }).click();
    await expect.element(screen.getByRole('button', { name: /종합병원/ })).toHaveTextContent('내과 · 외과 · 안과 외 2개');
  });
});
