// 공지 목록 - 피보호자 화면(variant="ward")만 본문 폭 제한과 새로고침 줄 빈 칸을 없앤다.
// 100자로 잘린 미리보기는 …을 붙이고 펼치면 상세로 전체 본문을 받는다, 20건씩 더 보기. 실제 Chrome에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { IAnnouncement } from '@/service/interface/common/announcement';
import { NoticesPage } from './NoticesPage';

const api = vi.hoisted(() => ({ getAnnouncements: vi.fn(), getAnnouncementDetail: vi.fn() }));

vi.mock('@/service/api/common/announcement', () => api);

const notice = (id: number, content = `공지 ${id} 본문`): IAnnouncement => ({
  id,
  authorName: '관리자',
  title: `공지 ${id}`,
  content,
  viewCount: 0,
  createdAt: '2026-06-15T10:00:00+09:00',
  updatedAt: '2026-06-15T10:00:00+09:00',
});

beforeEach(() => {
  api.getAnnouncements.mockReset().mockResolvedValue([
    { ...notice(1), title: '서비스 점검 안내', content: '2026년 6월 16일 오후 10시부터 서버 점검이 예정되어 있습니다.' },
  ]);
  api.getAnnouncementDetail.mockReset();
});

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
    const screen = await renderPage('ward');
    const content = screen.getByText(/서버 점검이 예정되어/);
    await expect.element(content).toBeVisible();
    expect(getComputedStyle(content.element()).maxWidth).toBe('none');
    expect(firstCardGap()).toBe(0);
    await expect.element(screen.getByRole('button', { name: '공지사항 새로고침' })).toBeVisible();
  });

  it('기본(보호자 화면)은 지금처럼 78ch 폭과 새로고침 줄 간격을 유지한다', async () => {
    const screen = await renderPage();
    const content = screen.getByText(/서버 점검이 예정되어/);
    await expect.element(content).toBeVisible();
    expect(getComputedStyle(content.element()).maxWidth).not.toBe('none');
    expect(firstCardGap()).toBe(14);
  });
});

describe('NoticesPage 전체 본문·더 보기', () => {
  it('100자로 잘린 미리보기는 …을 붙이고, 카드를 누르면 상세 창에 전체 본문을 보이며 10분 안에 다시 열어도 상세를 다시 부르지 않는다', async () => {
    const full = `${'가'.repeat(99)}😀 그리고 이어지는 뒷부분 본문`;
    const preview = Array.from(full).slice(0, 100).join('');
    api.getAnnouncements.mockResolvedValue([notice(7, preview)]);
    api.getAnnouncementDetail.mockResolvedValue(notice(7, full));
    await renderPage();

    await expect.element(page.getByText(`${preview}…`)).toBeVisible();
    expect(api.getAnnouncementDetail).not.toHaveBeenCalled();

    await page.getByRole('button', { name: /공지 7/ }).click();
    const dialog = page.getByRole('dialog', { name: '공지 7' });
    await expect.element(dialog.getByText(full)).toBeVisible();
    expect(api.getAnnouncementDetail).toHaveBeenCalledTimes(1);
    expect(api.getAnnouncementDetail).toHaveBeenCalledWith(7);

    await dialog.getByRole('button', { name: '닫기' }).click();
    expect(page.getByRole('dialog').query()).toBeNull();
    await page.getByRole('button', { name: /공지 7/ }).click();
    await expect.element(page.getByRole('dialog').getByText(full)).toBeVisible();
    expect(api.getAnnouncementDetail).toHaveBeenCalledTimes(1);
  });

  it('짧은 공지도 …없이 보이다가, 누르면 상세를 불러 창으로 열고 Esc로 닫는다(목록을 그릴 때는 부르지 않는다)', async () => {
    const content = '2026년 6월 16일 오후 10시부터 서버 점검이 예정되어 있습니다.';
    api.getAnnouncementDetail.mockResolvedValue({ ...notice(1), title: '서비스 점검 안내', content });
    await renderPage();

    await expect.element(page.getByText(content, { exact: true })).toBeVisible();
    expect(api.getAnnouncementDetail).not.toHaveBeenCalled();

    await page.getByRole('button', { name: /서비스 점검 안내/ }).click();
    await expect.element(page.getByRole('dialog', { name: '서비스 점검 안내' }).getByText(content)).toBeVisible();
    expect(api.getAnnouncementDetail).toHaveBeenCalledWith(1);

    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(page.getByRole('dialog').query()).toBeNull());
  });

  it('20건을 받으면 더 보기로 다음 페이지를 이어 붙이고, 20건보다 적게 오면 버튼을 숨긴다', async () => {
    api.getAnnouncements.mockImplementation(async ({ page: pageIndex }: { page: number }) =>
      pageIndex === 0 ? Array.from({ length: 20 }, (_, i) => notice(100 - i)) : [notice(80), notice(79)],
    );
    await renderPage();

    await expect.element(page.getByRole('heading', { name: '공지 81', exact: true })).toBeVisible();
    expect(api.getAnnouncements).toHaveBeenCalledWith({ page: 0, size: 20 });
    await page.getByRole('button', { name: '더 보기' }).click();

    await expect.element(page.getByRole('heading', { name: '공지 79', exact: true })).toBeVisible();
    expect(api.getAnnouncements).toHaveBeenLastCalledWith({ page: 1, size: 20 });
    expect(page.getByRole('button', { name: '더 보기' }).query()).toBeNull();
    const titles = page.getByRole('heading', { level: 2 }).elements().map(element => element.textContent?.replace('▼', ''));
    expect(titles.slice(18)).toEqual(['공지 82', '공지 81', '공지 80', '공지 79']);
  });

  it('새로고침은 더 보기로 받은 페이지가 아니라 첫 페이지부터 다시 받는다', async () => {
    api.getAnnouncements.mockImplementation(async ({ page: pageIndex }: { page: number }) =>
      pageIndex === 0 ? Array.from({ length: 20 }, (_, i) => notice(100 - i)) : [notice(80)],
    );
    await renderPage();
    await page.getByRole('button', { name: '더 보기' }).click();
    await expect.element(page.getByRole('heading', { name: '공지 80', exact: true })).toBeVisible();
    api.getAnnouncements.mockClear();

    await page.getByRole('button', { name: '공지사항 새로고침' }).click();

    await vi.waitFor(() => expect(api.getAnnouncements).toHaveBeenCalledWith({ page: 0, size: 20 }));
    await expect.element(page.getByRole('button', { name: '더 보기' })).toBeVisible();
    expect(page.getByRole('heading', { name: '공지 80', exact: true }).query()).toBeNull();
    expect(api.getAnnouncements).not.toHaveBeenCalledWith({ page: 1, size: 20 });
  });

  it('공지가 없으면 "등록된 공지사항이 없습니다."를 보인다', async () => {
    api.getAnnouncements.mockResolvedValue([]);
    await renderPage();

    await expect.element(page.getByText('등록된 공지사항이 없습니다.')).toBeVisible();
    expect(page.getByRole('button', { name: '더 보기' }).query()).toBeNull();
  });
});
