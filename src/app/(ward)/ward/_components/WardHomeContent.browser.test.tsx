// 피보호자 홈 - 화면 읽기 프로그램·자동 점검이 찾을 h1, 안부 대화 시간에만 보이는 말벗 카드. 실제 Chrome에서 돈다(`npm run test:browser`)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { IWardCompanionToday } from '@/service/interface/ward/companion';
import { WardHomeContent } from './WardHomeContent';

const api = vi.hoisted(() => ({ today: vi.fn() }));
vi.mock('@/service/api/ward/companion', () => ({ getWardCompanionToday: api.today }));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function today(currentSlot: string | null): IWardCompanionToday {
  return {
    date: '2026-11-11',
    currentSlot,
    slots: ['09:00', '12:00', '15:00', '18:00', '21:00'].map(slot => ({
      slot,
      status: slot === currentSlot ? 'AVAILABLE' : 'UPCOMING',
      mood: null,
    })),
  };
}

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WardHomeContent />
    </QueryClientProvider>,
  );
}

const companionLink = () => page.getByRole('link', { name: /지금 안부 대화할 시간이에요/ });

describe('WardHomeContent (Chrome)', () => {
  beforeEach(() => {
    api.today.mockReset();
    api.today.mockResolvedValue(today(null));
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('보이지 않는 h1 "피보호자 홈"을 두고, 기능 카드는 그대로 보인다', async () => {
    await renderHome();

    await expect.element(page.getByRole('heading', { name: '피보호자 홈', level: 1 })).toBeInTheDocument();
    await expect.element(page.getByRole('link', { name: '긴급 전화' })).toBeVisible();
  });

  it('안부 대화 시간이 아니면 말벗 카드가 없다(시간표·대기 안내도 없음)', async () => {
    await renderHome();

    await vi.waitFor(() => expect(api.today).toHaveBeenCalled());
    await expect.element(page.getByRole('link', { name: '긴급 전화' })).toBeVisible();
    expect(companionLink().query()).toBeNull();
    expect(page.getByText('안부', { exact: false }).query()).toBeNull();
  });

  it('안부 대화 시간이면 맨 위에 [대화하기] 카드가 말벗 화면으로 이어진다', async () => {
    api.today.mockResolvedValue(today('15:00'));
    await renderHome();

    await expect.element(companionLink()).toBeVisible();
    expect(companionLink().element().getAttribute('href')).toBe('/ward/companion');
    await expect.element(page.getByText('대화하기', { exact: true })).toBeVisible();
  });

  it('말벗이 꺼진 서버(오늘 현황 오류)면 카드가 없다', async () => {
    api.today.mockRejectedValue(new Error('503'));
    await renderHome();

    await vi.waitFor(() => expect(api.today).toHaveBeenCalled());
    await expect.element(page.getByRole('link', { name: '긴급 전화' })).toBeVisible();
    expect(companionLink().query()).toBeNull();
  });

  it.each([
    [375, 800],
    [820, 1180],
    [1280, 800],
  ])('폭 %ipx: 말벗 카드가 생겨도 가로로 넘치지 않는다', async (width, height) => {
    api.today.mockResolvedValue(today('15:00'));
    await page.viewport(width, height);
    await renderHome();

    await expect.element(companionLink()).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  });
});
