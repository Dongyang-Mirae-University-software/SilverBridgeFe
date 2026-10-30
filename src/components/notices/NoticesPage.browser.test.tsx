// 공지 목록 - 피보호자 화면(variant="ward")만 본문 폭 제한과 새로고침 줄 빈 칸을 없앤다. 실제 Chrome에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { NoticesPage } from './NoticesPage';

vi.mock('@/service/api/common/announcement', async importOriginal => ({
  ...(await importOriginal<typeof import('@/service/api/common/announcement')>()),
  getAnnouncements: vi.fn().mockResolvedValue([
    { id: 1, title: '서비스 점검 안내', content: '2026년 6월 16일 오후 10시부터 서버 점검이 예정되어 있습니다.', createdAt: '2026-06-15T10:00:00' },
  ]),
}));

afterEach(() => {
  document.body.innerHTML = '';
});

function renderPage(variant?: 'ward') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NoticesPage variant={variant} />
    </QueryClientProvider>,
  );
}

const firstCardGap = () => {
  const page = document.querySelector('section') as HTMLElement;
  const card = page.querySelector('article') as HTMLElement;
  return card.getBoundingClientRect().top - page.getBoundingClientRect().top;
};

describe('NoticesPage', () => {
  it('피보호자 화면: 본문 폭 제한이 없고 첫 카드 위에 빈 칸이 없다', async () => {
    const screen = renderPage('ward');
    const content = screen.getByText(/서버 점검이 예정되어/);
    await expect.element(content).toBeVisible();
    expect(getComputedStyle(content.element()).maxWidth).toBe('none');
    expect(firstCardGap()).toBe(0);
    await expect.element(screen.getByRole('button', { name: '공지사항 새로고침' })).toBeVisible();
  });

  it('기본(보호자 화면)은 지금처럼 78ch 폭과 새로고침 줄 간격을 유지한다', async () => {
    const screen = renderPage();
    const content = screen.getByText(/서버 점검이 예정되어/);
    await expect.element(content).toBeVisible();
    expect(getComputedStyle(content.element()).maxWidth).not.toBe('none');
    expect(firstCardGap()).toBe(14);
  });
});
