// 피보호자 약 알림은 푸시로만 간다 - 이 기기 알림이 꺼져 있으면 허용을 안내한다. 실제 Chrome에서 돈다
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { WardPushPermissionNotice } from './WardPushPermissionNotice';

const fcm = vi.hoisted(() => ({ register: vi.fn() }));
vi.mock('@/lib/fcm', () => ({ registerFcmTokenForCurrentDevice: fcm.register }));
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

const notification = { permission: 'default' as NotificationPermission };

beforeEach(() => {
  notification.permission = 'default';
  vi.stubGlobal('Notification', notification);
  fcm.register.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('피보호자 알림 허용 안내 (Chrome)', () => {
  it('아직 묻지 않았으면 "알림 켜기"로 허용을 요청하고, 허용되면 안내를 닫는다', async () => {
    fcm.register.mockImplementation(async () => {
      notification.permission = 'granted';
      return 'token';
    });
    await render(<WardPushPermissionNotice />);

    await expect.element(page.getByText('약 먹을 시간 알림이 꺼져 있어요')).toBeVisible();
    await page.getByRole('button', { name: '알림 켜기' }).click();

    expect(fcm.register).toHaveBeenCalledTimes(1);
    await expect.element(page.getByText('약 먹을 시간 알림이 꺼져 있어요')).not.toBeInTheDocument();
  });

  it('거절했으면 다시 물을 수 없어 브라우저 설정에서 바꾸는 방법만 안내한다', async () => {
    notification.permission = 'denied';
    await render(<WardPushPermissionNotice />);

    await expect.element(page.getByText('약 먹을 시간 알림이 꺼져 있어요')).toBeVisible();
    await expect.element(page.getByText(/자물쇠를 눌러/)).toBeVisible();
    expect(page.getByRole('button', { name: '알림 켜기' }).elements()).toHaveLength(0);
  });

  it('허용했거나 알림을 못 쓰는 브라우저면 아무것도 보이지 않는다', async () => {
    notification.permission = 'granted';
    await render(<WardPushPermissionNotice />);
    expect(document.body.textContent).not.toContain('알림이 꺼져 있어요');

    vi.unstubAllGlobals();
    vi.stubGlobal('Notification', undefined);
    Reflect.deleteProperty(window, 'Notification');
    document.body.innerHTML = '';
    await render(<WardPushPermissionNotice />);
    expect(document.body.textContent).not.toContain('알림이 꺼져 있어요');
  });
});
