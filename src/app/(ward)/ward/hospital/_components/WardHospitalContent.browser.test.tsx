// 피보호자 병원 예약 현황 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 보기 전용: 다음 진료(큰 D-day 카드) · 그다음 예약 카드 1장, 지난 진료·시연 안내는 싣지 않는다

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import { RESERVATION_DEMO_NOTICE } from '@/constants/reservation';
import type { IHospital, IReservationItem } from '@/service/interface/reservation';
import { addDays, formatDateLong, kstToday } from '@/utils/reservation/reservationView';
import { WardHospitalContent } from './WardHospitalContent';

const api = vi.hoisted(() => ({
  getHospitals: vi.fn(),
  getAvailableSlots: vi.fn(),
  getMyReservations: vi.fn(),
  createReservation: vi.fn(),
  cancelReservation: vi.fn(),
}));

vi.mock('@/service/api/guardian/reservation', () => api);

const TODAY = kstToday();

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
    symptomSummary: '기침',
    createdAt: '',
  };
}

const HOSPITAL: IHospital = {
  id: 1,
  name: '강남내과',
  region: '서울',
  address: '서울 강남구 테헤란로 152, 3층',
  phone: '02-1234-5678',
  departments: ['내과'],
  operationStatus: 'OPEN',
  congestionLevel: 'LOW',
  bookingAvailable: true,
  description: '',
  openTime: '09:00',
  closeTime: '18:00',
};

function renderContent(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<WardHospitalContent />, { wrapper });
}

describe('WardHospitalContent (Chrome)', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset());
    api.getHospitals.mockResolvedValue([HOSPITAL]);
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('다가오는 진료만 보여 주고 지난 진료·시연 안내는 없으며, 버튼은 하나도 없다', async () => {
    api.getMyReservations.mockResolvedValue([
      reservation(1, addDays(TODAY, 2), '10:00'),
      reservation(2, addDays(TODAY, 5), '14:30', 'CONFIRMED', '푸른안과'),
      reservation(3, addDays(TODAY, -3), '10:00', 'COMPLETED', '서울정형외과'),
    ]);
    const screen = renderContent();

    const next = screen.getByRole('region', { name: '다음 진료' });
    await expect.element(next.getByText('병원 가는 날')).toBeVisible();
    await expect.element(next.getByText('2일 뒤')).toBeVisible();
    expect(screen.getByText(RESERVATION_DEMO_NOTICE).elements()).toHaveLength(0);
    await expect.element(next.getByText(formatDateLong(addDays(TODAY, 2)))).toBeVisible();
    await expect.element(next.getByText('오전 10시')).toBeVisible();
    // 주소는 병원 목록에서 이름으로 찾아 붙인다
    await expect.element(next.getByText('서울 강남구 테헤란로 152, 3층')).toBeVisible();

    const later = screen.getByRole('region', { name: '그 밖의 예약' });
    await expect.element(later).toHaveTextContent('푸른안과');
    await expect.element(later.getByText('그다음')).toBeVisible();
    await expect.element(later.getByText('5일 뒤')).toBeVisible();
    await expect.element(later.getByText('오후 2시 30분')).toBeVisible();
    // 지난 진료는 피보호자 화면에 싣지 않는다
    expect(screen.getByRole('region', { name: '지난 진료' }).elements()).toHaveLength(0);
    expect(screen.getByText('서울정형외과').elements()).toHaveLength(0);
    await expect.element(screen.getByText('예약은 보호자가 대신 잡아 드려요')).toBeVisible();

    // 증상(건강 정보)은 화면에 싣지 않는다
    expect(screen.getByText('기침').elements()).toHaveLength(0);
    expect(screen.getByRole('button').elements()).toHaveLength(0);
    expect(api.getMyReservations).toHaveBeenCalledWith(undefined);
    // 375px(테스트 화면 폭)에서 가로로 넘치지 않는다
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('오늘 진료는 "오늘", 내일 진료는 "내일"', async () => {
    api.getMyReservations.mockResolvedValue([
      reservation(1, TODAY, '23:59'),
      reservation(2, addDays(TODAY, 1), '10:00', 'BOOKED', '푸른안과'),
    ]);
    const screen = renderContent();
    await expect.element(screen.getByRole('region', { name: '다음 진료' }).getByText('오늘')).toBeVisible();
    await expect.element(screen.getByRole('region', { name: '그 밖의 예약' }).getByText('내일')).toBeVisible();
  });

  it('예약이 없으면 빈 상태를 따로 안내한다', async () => {
    api.getMyReservations.mockResolvedValue([]);
    const screen = renderContent();
    await expect.element(screen.getByText('병원 갈 날이 없어요')).toBeVisible();
    expect(screen.getByText('지난 진료가 없어요').elements()).toHaveLength(0);
  });

  it('띄어쓰기 없는 긴 병원 이름도 320px에서 가로로 넘치지 않는다', async () => {
    const longName = '서울특별시립보라매병원부속노인전문재활의학과의원';
    await page.viewport(320, 812);
    api.getHospitals.mockResolvedValue([{ ...HOSPITAL, name: longName }]);
    api.getMyReservations.mockResolvedValue([
      reservation(1, addDays(TODAY, 123), '10:00', 'BOOKED', longName),
      reservation(2, addDays(TODAY, 365), '14:45', 'BOOKED', longName),
      reservation(3, addDays(TODAY, -1), '10:00', 'CANCELED', longName),
    ]);
    const screen = renderContent();
    await expect.element(screen.getByText('123일 뒤')).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
    await page.viewport(375, 812);
  });

  it('다가오는 예약이 많으면 그다음 카드는 1장만 보이고 더 보기로 펼친다', async () => {
    api.getMyReservations.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => reservation(i + 1, addDays(TODAY, i + 1), '10:00', 'BOOKED', `다음병원${i + 1}`)),
    );
    const screen = renderContent();
    const later = screen.getByRole('region', { name: '그 밖의 예약' });
    await expect.element(later).toHaveTextContent('다음병원2');
    expect(later.getByText('다음병원3').elements()).toHaveLength(0);

    const more = screen.getByRole('button', { name: '예약 4건 더 보기' });
    await expect.element(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect.element(later).toHaveTextContent('다음병원6');
    await expect.element(screen.getByRole('button', { name: '접기' })).toHaveAttribute('aria-expanded', 'true');

    await screen.getByRole('button', { name: '접기' }).click();
    await expect.element(screen.getByRole('button', { name: '예약 4건 더 보기' })).toBeVisible();
    expect(later.getByText('다음병원6').elements()).toHaveLength(0);
  });

  it('그다음 예약이 1건이면 더 보기 버튼이 없다', async () => {
    api.getMyReservations.mockResolvedValue(
      Array.from({ length: 2 }, (_, i) => reservation(i + 1, addDays(TODAY, i + 1), '10:00', 'BOOKED', `다음병원${i + 1}`)),
    );
    const screen = renderContent();
    await expect.element(screen.getByRole('region', { name: '그 밖의 예약' })).toHaveTextContent('다음병원2');
    expect(screen.getByRole('button').elements()).toHaveLength(0);
  });

  it('켜 둔 화면을 다시 불러오다 실패해도 보이던 예약은 그대로 둔다', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.getMyReservations.mockResolvedValue([reservation(1, addDays(TODAY, 2), '10:00')]);
    const screen = renderContent(queryClient);
    await expect.element(screen.getByText('2일 뒤')).toBeVisible();

    api.getMyReservations.mockRejectedValue(new Error('down'));
    await queryClient.refetchQueries();
    // 갱신 실패가 쿼리 상태에 들어가고 화면이 다시 그려질 때까지 기다린 뒤 본다
    await vi.waitFor(() =>
      expect(queryClient.getQueryCache().getAll().some(query => query.state.status === 'error')).toBe(true),
    );
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(screen.getByRole('alert').elements()).toHaveLength(0);
    await expect.element(screen.getByText('2일 뒤')).toBeVisible();
  });

  it('켜 둔 화면에 보호자가 새로 잡은 예약이 다시 불러오면 나타난다', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.getMyReservations.mockResolvedValue([]);
    const screen = renderContent(queryClient);
    await expect.element(screen.getByText('병원 갈 날이 없어요')).toBeVisible();

    api.getMyReservations.mockResolvedValue([reservation(1, addDays(TODAY, 2), '10:00')]);
    await queryClient.refetchQueries();
    await expect.element(screen.getByText('2일 뒤')).toBeVisible();
  });

  it('병원 목록을 못 불러와도 예약은 보이고 주소만 빠진다', async () => {
    api.getHospitals.mockRejectedValue(new Error('down'));
    api.getMyReservations.mockResolvedValue([reservation(1, addDays(TODAY, 1), '10:00')]);
    const screen = renderContent();
    await expect.element(screen.getByText('내일')).toBeVisible();
    expect(screen.getByText('서울 강남구 테헤란로 152, 3층').elements()).toHaveLength(0);
  });

  it('예약 서비스가 꺼져 있으면(503) 안내와 다시 불러오기', async () => {
    const error = new AxiosError('x');
    error.response = { status: 503, data: {}, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
    api.getMyReservations.mockRejectedValue(error);
    const screen = renderContent();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('지금은 병원 예약 서비스를 쓸 수 없어요.');
    await expect.element(screen.getByRole('button', { name: '다시 불러오기' })).toBeVisible();
  });

  // 메뉴에서 들어오면 큰 카드와 그다음 카드가 스크롤 없이 보인다.
  // 남는 높이 = 화면 - 헤더(76 + 아래 여백 10) - 본문 위아래 패딩(901px 이상 28·20, 미만 18·28)
  it.each([
    [1280, 800, 48],
    [768, 1024, 46],
  ])('%ipx×%ipx 한 화면에 큰 카드·그다음 카드·안내 문구가 다 들어간다', async (width, height, padding) => {
    await page.viewport(width, height);
    api.getMyReservations.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => reservation(i + 1, addDays(TODAY, i + 1), '10:00', 'BOOKED', `다음병원${i + 1}`)),
    );
    const screen = renderContent();
    await expect.element(screen.getByText('예약은 보호자가 대신 잡아 드려요')).toBeVisible();
    expect(window.innerWidth).toBe(width);
    const content = screen.container.firstElementChild as HTMLElement;
    expect(content.getBoundingClientRect().height).toBeLessThanOrEqual(height - 86 - padding);
    await page.viewport(375, 812);
  });

  it('375px에서는 넘치더라도 큰 카드는 한 화면 안에 다 보인다', async () => {
    api.getMyReservations.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => reservation(i + 1, addDays(TODAY, i + 1), '10:00', 'BOOKED', `다음병원${i + 1}`)),
    );
    const screen = renderContent();
    const next = screen.getByRole('region', { name: '다음 진료' });
    await expect.element(next).toBeVisible();
    expect((next.element() as HTMLElement).getBoundingClientRect().height).toBeLessThanOrEqual(812 - 86 - 46);
  });
});
