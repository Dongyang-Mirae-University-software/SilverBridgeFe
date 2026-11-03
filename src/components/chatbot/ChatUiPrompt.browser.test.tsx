// 챗봇 말풍선 안 입력형 선택지 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
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
    await expect.element(page.getByLabelText('날짜 선택')).toBeVisible();
  });
});
