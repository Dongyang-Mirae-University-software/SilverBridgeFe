// 119 키패드 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 학생 프로젝트라 통화 버튼은 아무 데도 걸지 않고 안내만 띄운다(2026-10-23, 휴대폰 키패드 모양으로 교체)
// 점검 반영(2026-10-23): 포커스 가둠/복귀·가로 화면 키 최소 48px. 보호자 알림 문구는 키패드에 띄우지 않는다(사용자 결정)

import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from '@vitest/browser/context';

import { DEMO_CALL_NOTICE, Emergency119Dialpad } from './Emergency119Dialpad';

describe('Emergency119Dialpad (Chrome)', () => {
  afterEach(async () => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    await page.viewport(375, 812);
  });

  it('열리면 119가 입력돼 있고, 키 입력·지우기가 된다', async () => {
    const screen = render(<Emergency119Dialpad onClose={() => {}} />);
    const display = screen.getByLabelText('입력된 번호');

    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    await expect.element(display).toHaveTextContent('119');
    // 상단 안내는 대화상자 설명으로 연결돼 화면 낭독기가 함께 읽는다
    await expect
      .element(screen.getByRole('dialog'))
      .toHaveAccessibleDescription('학생 프로젝트 화면 · 실제로 신고 전화가 발신되지 않습니다');
    // 보호자 알림 문구는 키패드에 띄우지 않는다
    expect(screen.getByText(/보호자에게/).query()).toBeNull();

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
    const screen = render(<Emergency119Dialpad onClose={() => {}} />);

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

  it('Tab을 여러 번 눌러도 포커스가 키패드 밖(가려진 SOS 버튼)으로 나가지 않고, 닫으면 SOS 버튼으로 돌아온다', async () => {
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            긴급 SOS
          </button>
          {open && <Emergency119Dialpad onClose={() => setOpen(false)} />}
        </>
      );
    }
    const screen = render(<Page />);
    const sos = screen.getByRole('button', { name: '긴급 SOS' });
    await sos.click();
    const dialog = screen.getByRole('dialog', { name: /119 신고 키패드/ });
    await expect.element(dialog).toBeVisible();

    for (let i = 0; i < 20; i += 1) {
      await userEvent.keyboard('{Tab}');
      expect(dialog.element().contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 5; i += 1) {
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      expect(dialog.element().contains(document.activeElement)).toBe(true);
    }

    await userEvent.keyboard('{Escape}');
    await expect.element(dialog).not.toBeInTheDocument();
    expect(document.activeElement).toBe(sos.element());
  });

  it('375px 화면에서 키·통화 버튼이 화면 안에 있고 가로로 넘치지 않는다', async () => {
    const screen = render(<Emergency119Dialpad onClose={() => {}} />);
    const call = screen.getByRole('button', { name: /실제로 걸리지 않음/ });
    await expect.element(call).toBeVisible();

    const rect = call.element().getBoundingClientRect();
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(rect.width).toBeGreaterThanOrEqual(64);
    const keyRect = screen.getByRole('button', { name: '5' }).element().getBoundingClientRect();
    expect(keyRect.width).toBeGreaterThanOrEqual(64);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('가로 화면(812×375)에서도 키 지름이 48px 이상이고, 통화 버튼은 스크롤로 닿는다', async () => {
    await page.viewport(812, 375);
    const screen = render(<Emergency119Dialpad onClose={() => {}} />);
    const call = screen.getByRole('button', { name: /실제로 걸리지 않음/ });
    await expect.element(call).toBeInTheDocument();

    for (const name of ['1', '5', '샵']) {
      const width = screen.getByRole('button', { name, exact: true }).element().getBoundingClientRect().width;
      expect(width).toBeGreaterThanOrEqual(48);
    }
    expect(call.element().getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
    call.element().scrollIntoView({ block: 'nearest' });
    expect(call.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});
