// 챗봇 말풍선 안 입력형 선택지 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import ChatUiPrompt from './ChatUiPrompt';

describe('ChatUiPrompt 입력형', () => {
  it('좁은 말풍선에서도 적용 버튼이 칸 안에 남는다', async () => {
    await render(
      <div data-testid="bubble" style={{ width: 220, overflow: 'hidden' }}>
        <ChatUiPrompt ui={{ kind: 'text', field: 'region', label: '지역을 입력해 주세요', placeholder: '예: 서울 강남구' }} active onSelect={vi.fn()} />
      </div>,
    );

    await expect.element(page.getByRole('button', { name: '적용' })).toBeVisible();
    const bubble = page.getByTestId('bubble').element().getBoundingClientRect();
    const button = page.getByRole('button', { name: '적용' }).element().getBoundingClientRect();
    expect(button.right).toBeLessThanOrEqual(bubble.right);
  });

  it('입력칸은 안내 문구를 이름으로 갖고, 문구가 없으면 기본 이름을 쓴다', async () => {
    await render(
      <>
        <ChatUiPrompt ui={{ kind: 'text', field: 'region', label: '지역을 입력해 주세요' }} active onSelect={vi.fn()} />
        <ChatUiPrompt ui={{ kind: 'date', field: 'date' }} active onSelect={vi.fn()} />
      </>,
    );

    await expect.element(page.getByRole('textbox', { name: '지역을 입력해 주세요' })).toBeVisible();
    // 날짜는 7일 버튼이 먼저, 달력은 [달력에서 다른 날 고르기]를 누르면 펼친다(2026-11-04)
    await userEvent.click(page.getByRole('button', { name: '달력에서 다른 날 고르기' }));
    await expect.element(page.getByLabelText('날짜 선택')).toBeVisible();
  });
});
