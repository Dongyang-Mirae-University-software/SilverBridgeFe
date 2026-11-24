// 인증번호 남은 시간 - 화면이 멈춰 있던 동안의 시간도 반영하는지 고정한다(2026-11-24, 가입 문자 인증 만료 오표시)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import useTimer from './useTimer';

function Probe({ seconds }: { seconds: number }) {
  const { formattedTime, isExpired } = useTimer(seconds);
  return (
    <>
      <output data-testid="time">{formattedTime}</output>
      <button type="button" disabled={isExpired}>
        확인
      </button>
    </>
  );
}

describe('useTimer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('다른 앱에 다녀오면 멈춰 있던 시간만큼 바로 줄어든다', async () => {
    const base = Date.now();
    const now = vi.spyOn(Date, 'now').mockReturnValue(base);
    const screen = await render(<Probe seconds={300} />);
    await expect.element(screen.getByTestId('time')).toHaveTextContent('05:00');

    // 문자 앱에 2분 있는 동안 타이머가 한 번도 돌지 않은 상황
    now.mockReturnValue(base + 120_000);
    document.dispatchEvent(new Event('visibilitychange'));

    await expect.element(screen.getByTestId('time')).toHaveTextContent('03:00');
    await expect.element(screen.getByRole('button', { name: '확인' })).toBeEnabled();
  });

  it('5분이 지난 뒤 돌아오면 바로 만료로 보이고 확인 버튼이 꺼진다', async () => {
    const base = Date.now();
    const now = vi.spyOn(Date, 'now').mockReturnValue(base);
    const screen = await render(<Probe seconds={300} />);

    // 오늘 prod에서 본 경우: 발송 5분 48초 뒤 확인
    now.mockReturnValue(base + 348_000);
    window.dispatchEvent(new Event('focus'));

    await expect.element(screen.getByTestId('time')).toHaveTextContent('00:00');
    await expect.element(screen.getByRole('button', { name: '확인' })).toBeDisabled();
  });

  it('화면이 계속 보이는 동안에는 1초마다 줄어든다', async () => {
    const screen = await render(<Probe seconds={3} />);
    await expect.element(screen.getByTestId('time')).toHaveTextContent('00:03');
    await expect.element(screen.getByTestId('time'), { timeout: 2500 }).toHaveTextContent('00:02');
  });
});
