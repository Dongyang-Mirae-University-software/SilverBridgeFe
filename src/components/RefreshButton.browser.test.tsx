// 새로고침 버튼 위치 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { RefreshButton } from './RefreshButton';

describe('RefreshButton (Chrome)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // inline은 숨긴 라벨을 가두려고 relative지만, 떠 있는 버튼의 right·bottom(16px)·z-index를
  // 받으면 제자리에서 밀린다 (2026-10-24 점검 H-1)
  it('inline 버튼은 흐름 위치 그대로 놓이고 쌓임 순서를 만들지 않는다', async () => {
    const box = document.createElement('div');
    box.style.padding = '40px';
    document.body.appendChild(box);
    const screen = render(<RefreshButton placement="inline" onRefresh={() => undefined} />, { container: box });
    const button = screen.getByRole('button', { name: '새로고침' });
    await expect.element(button).toBeInTheDocument();

    const rect = button.element().getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    expect(rect.left - boxRect.left).toBe(40);
    expect(rect.top - boxRect.top).toBe(40);
    expect(getComputedStyle(button.element()).zIndex).toBe('auto');
  });

  it('기본(떠 있는) 버튼은 화면 오른쪽 아래에 고정된다', async () => {
    const screen = render(<RefreshButton onRefresh={() => undefined} />);
    const button = screen.getByRole('button', { name: '새로고침' });
    await expect.element(button).toBeInTheDocument();

    expect(getComputedStyle(button.element()).position).toBe('fixed');
    expect(Math.round(window.innerWidth - button.element().getBoundingClientRect().right)).toBe(16);
  });
});
