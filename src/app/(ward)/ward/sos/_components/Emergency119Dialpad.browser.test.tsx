// 119 키패드 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 학생 프로젝트라 통화 버튼은 아무 데도 걸지 않고 안내만 띄운다(2026-10-23, 휴대폰 키패드 모양으로 교체)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from '@vitest/browser/context';

import { DEMO_CALL_NOTICE, Emergency119Dialpad } from './Emergency119Dialpad';

describe('Emergency119Dialpad (Chrome)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('열리면 119가 입력돼 있고, 키 입력·지우기가 된다', async () => {
    const screen = render(<Emergency119Dialpad onClose={() => {}} />);
    const display = screen.getByLabelText('입력된 번호');

    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    await expect.element(display).toHaveTextContent('119');
    await expect.element(screen.getByText('학생 프로젝트 화면 · 실제로 신고 전화가 발신되지 않습니다')).toBeVisible();
    // 보호자 알림 안내는 guardianNotified 일 때만
    expect(screen.getByText('보호자에게도 알렸어요').query()).toBeNull();

    await screen.getByRole('button', { name: '2' }).click();
    await screen.getByRole('button', { name: '별표' }).click();
    await expect.element(display).toHaveTextContent('1192*');

    await screen.getByRole('button', { name: '한 글자 지우기' }).click();
    await screen.getByRole('button', { name: '한 글자 지우기' }).click();
    await expect.element(display).toHaveTextContent('119');
  });

  it('통화 버튼은 안내만 띄우고 이동·새 창·링크가 없다', async () => {
    const openSpy = vi.spyOn(window, 'open');
    const hrefBefore = window.location.href;
    const screen = render(<Emergency119Dialpad guardianNotified onClose={() => {}} />);

    await expect.element(screen.getByText('보호자에게도 알렸어요')).toBeVisible();
    const call = screen.getByRole('button', { name: /실제로 걸리지 않음/ });
    await expect.element(call).toBeEnabled();
    expect(screen.getByText(DEMO_CALL_NOTICE).query()).toBeNull();

    await call.click();

    await expect.element(screen.getByText(DEMO_CALL_NOTICE)).toBeVisible();
    await expect.element(screen.getByLabelText('입력된 번호')).toHaveTextContent('119');
    expect(openSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(hrefBefore);
    expect(document.querySelectorAll('[role="dialog"] a').length).toBe(0);
  });

  it('닫기 버튼과 Esc로 닫는다', async () => {
    const onClose = vi.fn();
    const screen = render(<Emergency119Dialpad onClose={onClose} />);

    await screen.getByRole('button', { name: '119 화면 닫기' }).click();
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('375px 화면에서 키·통화 버튼이 화면 안에 있고 가로로 넘치지 않는다', async () => {
    const screen = render(<Emergency119Dialpad guardianNotified onClose={() => {}} />);
    const call = screen.getByRole('button', { name: /실제로 걸리지 않음/ });
    await expect.element(call).toBeVisible();

    const rect = call.element().getBoundingClientRect();
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(rect.width).toBeGreaterThanOrEqual(64);
    const keyRect = screen.getByRole('button', { name: '5' }).element().getBoundingClientRect();
    expect(keyRect.width).toBeGreaterThanOrEqual(64);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});
