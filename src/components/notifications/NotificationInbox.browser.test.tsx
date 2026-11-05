// 상단 종 알림함 - 안 읽은 수 뱃지, 묶음 탭, 한 건·모두 읽음, 눌러서 해당 화면으로. 실제 Chrome에서 돈다
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { INotificationInboxItem } from '@/service/interface/user/notificationInbox';
import { NotificationBellButton, NotificationPanel } from './NotificationInbox';

const api = vi.hoisted(() => ({ list: vi.fn(), count: vi.fn(), readOne: vi.fn(), readAll: vi.fn(), push: vi.fn(), selectWard: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock('@/store/selectedWardStore', () => ({ setSelectedWardId: api.selectWard }));
vi.mock('@/service/api/user/notificationInbox', () => ({
  getMyNotifications: api.list,
  getMyUnreadNotificationCount: api.count,
  readMyNotification: api.readOne,
  readAllMyNotifications: api.readAll,
}));

const FIRE: INotificationInboxItem = {
  id: 1024,
  type: 'ANOMALY_DETECTED',
  category: 'URGENT',
  title: '[화재 감지] 김영자님 댁 거실',
  body: '거실 카메라에서 화재가 감지되었습니다.\n지금 확인해 주세요.',
  createdAt: new Date().toISOString(),
  read: false,
  wardId: 'WD0001',
  wardName: '김영자',
};
const INQUIRY: INotificationInboxItem = {
  id: 1019,
  type: 'INQUIRY_ANSWERED',
  category: 'OTHER',
  title: '문의 답변 완료',
  body: '문의하신 내용에 답변이 등록되었습니다.',
  createdAt: '2026-11-01T10:00:00+09:00',
  read: true,
  wardId: null,
  wardName: null,
};

function pageOf(content: INotificationInboxItem[], last = true) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1, last };
}

function Harness({ role = 'GUARDIAN' }: { role?: 'GUARDIAN' | 'WARD' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <NotificationBellButton variant="guardian" open={open} onToggle={() => setOpen(value => !value)} />
      {open && <NotificationPanel role={role} variant="guardian" onClose={() => setOpen(false)} />}
    </>
  );
}

async function renderInbox(role?: 'GUARDIAN' | 'WARD') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness role={role} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
  api.count.mockResolvedValue(1);
  api.list.mockResolvedValue(pageOf([FIRE, INQUIRY]));
  api.readOne.mockResolvedValue(undefined);
  api.readAll.mockResolvedValue(1);
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('종 알림함 (Chrome)', () => {
  it('안 읽은 수를 뱃지로 보이고, 0이면 숨긴다', async () => {
    await renderInbox();
    await expect.element(page.getByRole('button', { name: '알림, 안 읽은 알림 1개' })).toBeVisible();

    document.body.innerHTML = '';
    api.count.mockResolvedValue(0);
    await renderInbox();
    await expect.element(page.getByRole('button', { name: '알림', exact: true })).toBeVisible();
  });

  it('열면 최신 알림을 보이고 본문 줄바꿈과 피보호자 이름을 그대로 둔다', async () => {
    await renderInbox();
    await page.getByRole('button', { name: /^알림/ }).click();

    await expect.element(page.getByRole('dialog', { name: '알림' })).toBeVisible();
    await expect.element(page.getByText('[화재 감지] 김영자님 댁 거실')).toBeVisible();
    expect(page.getByText('거실 카메라에서', { exact: false }).element().textContent).toBe('거실 카메라에서 화재가 감지되었습니다.\n지금 확인해 주세요.');
    await expect.element(page.getByText('김영자', { exact: true })).toBeVisible();
    expect(api.list).toHaveBeenLastCalledWith({ category: undefined, page: 0, size: 20 });
  });

  it('묶음 탭은 category로 다시 부른다', async () => {
    await renderInbox();
    await page.getByRole('button', { name: /^알림/ }).click();
    api.list.mockResolvedValue(pageOf([]));
    await page.getByRole('tab', { name: '복약' }).click();

    await expect.element(page.getByText('복약 알림이 없어요.')).toBeVisible();
    expect(api.list).toHaveBeenLastCalledWith({ category: 'MEDICATION', page: 0, size: 20 });
  });

  it('안 읽은 알림을 누르면 읽음 처리하고 그 피보호자를 골라 해당 화면으로 간다', async () => {
    await renderInbox();
    await page.getByRole('button', { name: /^알림/ }).click();
    api.count.mockResolvedValue(0);
    await page.getByText('[화재 감지] 김영자님 댁 거실').click();

    expect(api.readOne.mock.calls[0][0]).toBe(1024);
    expect(api.selectWard).toHaveBeenCalledWith('WD0001');
    expect(api.push).toHaveBeenCalledWith('/guardian/detection');
    await expect.element(page.getByRole('button', { name: '알림', exact: true })).toBeVisible();
    expect(page.getByRole('dialog').elements()).toHaveLength(0);
  });

  it('이미 읽은 알림은 읽음 처리를 다시 부르지 않는다', async () => {
    await renderInbox();
    await page.getByRole('button', { name: /^알림/ }).click();
    await page.getByText('문의 답변 완료').click();

    expect(api.readOne).not.toHaveBeenCalled();
    expect(api.push).toHaveBeenCalledWith('/guardian/inquiries');
  });

  it('모두 읽음을 누르면 뱃지가 사라지고 버튼이 꺼진다', async () => {
    await renderInbox();
    await page.getByRole('button', { name: /^알림/ }).click();
    api.count.mockResolvedValue(0);
    api.list.mockResolvedValue(pageOf([{ ...FIRE, read: true }, INQUIRY]));
    await page.getByRole('button', { name: '모두 읽음' }).click();

    await expect.element(page.getByRole('button', { name: '모두 읽음' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: '알림', exact: true })).toBeInTheDocument();
    expect(api.readAll).toHaveBeenCalledTimes(1);
  });

  it('다음 쪽이 있으면 더 보기로 이어 받는다', async () => {
    api.list.mockImplementation(async ({ page: pageNo }: { page: number }) =>
      pageNo === 0 ? pageOf([FIRE], false) : { ...pageOf([INQUIRY]), page: 1 },
    );
    await renderInbox();
    await page.getByRole('button', { name: /^알림/ }).click();
    await page.getByRole('button', { name: '더 보기' }).click();

    await expect.element(page.getByText('문의 답변 완료')).toBeVisible();
    expect(page.getByRole('button', { name: '더 보기' }).elements()).toHaveLength(0);
  });

  it('Esc로 닫는다', async () => {
    await renderInbox();
    await page.getByRole('button', { name: /^알림/ }).click();
    await expect.element(page.getByRole('dialog')).toBeVisible();
    await userEvent.keyboard('{Escape}');

    expect(page.getByRole('dialog').elements()).toHaveLength(0);
  });

  it('피보호자 본인 알림은 피보호자 화면으로 간다', async () => {
    api.list.mockResolvedValue(pageOf([{ ...FIRE, id: 7, type: 'MEDICATION_REMINDER', category: 'MEDICATION', title: '복약 알림', wardId: null, wardName: null }]));
    await renderInbox('WARD');
    await page.getByRole('button', { name: /^알림/ }).click();
    await page.getByText('복약 알림').click();

    expect(api.selectWard).not.toHaveBeenCalled();
    expect(api.push).toHaveBeenCalledWith('/ward/medication');
  });
});
