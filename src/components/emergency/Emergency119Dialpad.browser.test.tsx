// 119 키패드 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 학생 프로젝트라 통화 버튼은 아무 데도 걸지 않고 안내만 띄운다(2026-10-23, 휴대폰 키패드 모양으로 교체)
// 점검 반영(2026-10-23): 포커스 가둠/복귀·가로 화면 키 최소 48px. 보호자 알림 문구는 키패드에 띄우지 않는다(사용자 결정)
// 2026-11-19: 아이폰 전화 앱 키패드 모양 - 통화 줄 [빈칸·통화·지우기], 안내 문구는 숫자 위 한 줄

import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import {
  CALL_FAILED_NOTICE,
  CALL_OFFLINE_NOTICE,
  CALL_SENDING_NOTICE,
  CALL_SUCCESS_NOTICE,
  DEMO_CALL_NOTICE,
  Emergency119Dialpad,
} from './Emergency119Dialpad';

describe('Emergency119Dialpad (Chrome)', () => {
  afterEach(async () => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    await page.viewport(375, 812);
  });

  it('열리면 119가 입력돼 있고, 키 입력·지우기가 된다', async () => {
    const screen = await render(<Emergency119Dialpad onClose={() => {}} />);
    const display = screen.getByLabelText('입력된 번호');

    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    await expect.element(display).toMatchTextContent('119');
    // 상단 안내는 대화상자 설명으로 연결돼 화면 낭독기가 함께 읽는다
    await expect
      .element(screen.getByRole('dialog'))
      .toHaveAccessibleDescription('학생 프로젝트 화면 · 실제로 신고 전화가 발신되지 않습니다');
    // 보호자 알림 문구는 키패드에 띄우지 않는다
    expect(screen.getByText(/보호자에게/).query()).toBeNull();

    await screen.getByRole('button', { name: '2' }).click();
    await screen.getByRole('button', { name: '별표' }).click();
    await expect.element(display).toMatchTextContent('1192*');

    await screen.getByRole('button', { name: '한 글자 지우기' }).click();
    await screen.getByRole('button', { name: '한 글자 지우기' }).click();
    await expect.element(display).toMatchTextContent('119');
  });

  it('아이폰 키패드처럼 키 12개(영문 포함)와 통화 버튼, 통화 오른쪽 지우기를 둔다 - 지우기는 번호가 있을 때만', async () => {
    await page.viewport(390, 844);
    const screen = await render(<Emergency119Dialpad onClose={() => {}} />);
    const dialog = screen.getByRole('dialog').element();

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '별표', '0', '샵'];
    for (const name of keys) {
      await expect.element(screen.getByRole('button', { name, exact: true })).toBeVisible();
    }
    for (const letters of ['ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ', '+']) {
      await expect.element(screen.getByText(letters, { exact: true })).toBeVisible();
    }
    // 연락처 추가 같은 동작 없는 장식은 두지 않는다: 키 12 + 통화 + 지우기 + 닫기
    expect(dialog.querySelectorAll('button')).toHaveLength(15);

    const rectOf = (name: string | RegExp) => screen.getByRole('button', { name }).element().getBoundingClientRect();
    const call = rectOf(/실제로 걸리지 않음/);
    const zero = rectOf('0');
    const pound = rectOf('샵');
    const backspace = rectOf('한 글자 지우기');
    // 통화는 0 아래 가운데, 지우기는 # 아래(통화 오른쪽)
    expect(Math.abs(call.left + call.width / 2 - (zero.left + zero.width / 2))).toBeLessThan(2);
    expect(call.top).toBeGreaterThan(zero.bottom);
    expect(Math.abs(backspace.left + backspace.width / 2 - (pound.left + pound.width / 2))).toBeLessThan(2);
    expect(Math.abs(backspace.top + backspace.height / 2 - (call.top + call.height / 2))).toBeLessThan(2);
    // 키는 원형이고 390px 폭에서 스크린샷 비율(폭의 19.3%) 그대로 약 75px
    expect(zero.width).toBe(zero.height);
    expect(zero.width).toBeGreaterThanOrEqual(72);
    expect(zero.width).toBeLessThanOrEqual(78);

    for (let i = 0; i < 3; i += 1) await screen.getByRole('button', { name: '한 글자 지우기' }).click();
    await expect.element(screen.getByLabelText('입력된 번호')).toMatchTextContent(/^\s*$/);
    // 번호가 없으면 숨겨져 버튼 목록에서도 빠진다(자리는 남아 통화 버튼이 움직이지 않는다)
    const hiddenBackspace = dialog.querySelector<HTMLButtonElement>('button[aria-label="한 글자 지우기"]')!;
    expect(getComputedStyle(hiddenBackspace).visibility).toBe('hidden');
    expect(hiddenBackspace.disabled).toBe(true);
    expect(screen.getByRole('button', { name: /실제로 걸리지 않음/ }).element().getBoundingClientRect().left).toBe(call.left);
  });

  it('태블릿 폭에서는 키패드를 가운데에 두고 키를 키우지 않는다', async () => {
    await page.viewport(1024, 1366);
    const screen = await render(<Emergency119Dialpad onClose={() => {}} />);
    const five = screen.getByRole('button', { name: '5' }).element().getBoundingClientRect();
    expect(five.width).toBeLessThanOrEqual(78);
    expect(Math.abs(five.left + five.width / 2 - window.innerWidth / 2)).toBeLessThan(2);
  });

  it('시연 안내와 통화 결과는 숫자 위 같은 자리에 보인다', async () => {
    const screen = await render(<Emergency119Dialpad onClose={() => {}} onCall={() => new Promise(() => {})} />);
    const display = screen.getByLabelText('입력된 번호').element().getBoundingClientRect();
    const notice = screen.getByText('학생 프로젝트 화면 · 실제로 신고 전화가 발신되지 않습니다');
    await expect.element(notice).toBeVisible();
    expect(notice.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(display.top);

    await screen.getByRole('button', { name: /보호자에게 알림/ }).click();
    const status = screen.getByText(CALL_SENDING_NOTICE);
    await expect.element(status).toBeVisible();
    await expect.element(notice).not.toBeVisible();
    expect(status.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(display.top);
    expect(screen.getByLabelText('입력된 번호').element().getBoundingClientRect().top).toBe(display.top);
  });

  it('통화 버튼은 안내만 띄우고 이동·새 창·링크가 없다', async () => {
    const openSpy = vi.spyOn(window, 'open');
    const hrefBefore = window.location.href;
    const screen = await render(<Emergency119Dialpad onClose={() => {}} />);

    const call = screen.getByRole('button', { name: /실제로 걸리지 않음/ });
    await expect.element(call).toBeEnabled();
    expect(screen.getByText(DEMO_CALL_NOTICE).query()).toBeNull();

    await call.click();

    await expect.element(screen.getByText(DEMO_CALL_NOTICE)).toBeVisible();
    await expect.element(screen.getByLabelText('입력된 번호')).toMatchTextContent('119');
    expect(openSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(hrefBefore);
    expect(document.querySelectorAll('[role="dialog"] a').length).toBe(0);
  });

  it('닫기 버튼과 Esc로 닫는다', async () => {
    const onClose = vi.fn();
    const screen = await render(<Emergency119Dialpad onClose={onClose} />);

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
    const screen = await render(<Page />);
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
    const screen = await render(<Emergency119Dialpad onClose={() => {}} />);
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
    const screen = await render(<Emergency119Dialpad onClose={() => {}} />);
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

  describe('onCall(보호자 알림)', () => {
    const CALL = { name: /보호자에게 알림/ };

    it('보내는 동안 통화 버튼이 잠기고 안내가 뜨며, 성공하면 다시 눌러도 더 보내지 않는다', async () => {
      let resolve: (value?: unknown) => void = () => {};
      const onCall = vi.fn(() => new Promise(r => (resolve = r)));
      const screen = await render(<Emergency119Dialpad onClose={() => {}} onCall={onCall} />);
      const call = screen.getByRole('button', CALL);

      await call.click();
      await expect.element(screen.getByText(CALL_SENDING_NOTICE)).toBeVisible();
      await expect.element(call).toBeDisabled();
      await expect.element(call).toHaveAttribute('aria-busy', 'true');
      expect(onCall).toHaveBeenCalledTimes(1);

      resolve();
      await expect.element(screen.getByText(CALL_SUCCESS_NOTICE)).toBeVisible();
      await expect.element(call).toBeEnabled();
      await call.click();
      expect(onCall).toHaveBeenCalledTimes(1);
      await expect.element(screen.getByText(CALL_SUCCESS_NOTICE)).toBeVisible();
    });

    it('실패하면 다시 누르라는 안내를 보이고, 다시 누르면 재시도해 성공한다', async () => {
      const onCall = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({});
      const screen = await render(<Emergency119Dialpad onClose={() => {}} onCall={onCall} />);
      const call = screen.getByRole('button', CALL);

      await call.click();
      await expect.element(screen.getByText(CALL_FAILED_NOTICE)).toBeVisible();
      await expect.element(call).toBeEnabled();

      await call.click();
      await expect.element(screen.getByText(CALL_SUCCESS_NOTICE)).toBeVisible();
      expect(onCall).toHaveBeenCalledTimes(2);
    });

    it('오프라인이면 연결 안내 문구로 실패를 알린다', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const onCall = vi.fn().mockRejectedValue(new Error('x'));
      const screen = await render(<Emergency119Dialpad onClose={() => {}} onCall={onCall} />);

      await screen.getByRole('button', CALL).click();
      await expect.element(screen.getByText(CALL_OFFLINE_NOTICE)).toBeVisible();
    });

    it('footer 를 안내 아래에 그린다', async () => {
      const screen = await render(
        <Emergency119Dialpad onClose={() => {}} onCall={async () => {}} footer={<p>상담전화 109</p>} />,
      );
      await expect.element(screen.getByText('상담전화 109')).toBeVisible();
    });

    it('onCall 이 없으면 기존 시연 안내 그대로다', async () => {
      const screen = await render(<Emergency119Dialpad onClose={() => {}} />);
      await screen.getByRole('button', { name: /실제로 걸리지 않음/ }).click();
      await expect.element(screen.getByText(DEMO_CALL_NOTICE)).toBeVisible();
    });
  });
});
