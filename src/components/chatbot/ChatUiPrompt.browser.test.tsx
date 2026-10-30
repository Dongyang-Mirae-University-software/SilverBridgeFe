// 챗봇 말풍선 안 입력형 선택지 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import ChatUiPrompt from './ChatUiPrompt';

describe('ChatUiPrompt 입력형', () => {
  it('좁은 말풍선에서도 적용 버튼이 칸 안에 남는다', async () => {
    render(
      <div data-testid="bubble" style={{ width: 220, overflow: 'hidden' }}>
        <ChatUiPrompt ui={{ kind: 'text', field: 'region', label: '지역을 입력해 주세요', placeholder: '예: 서울 강남구' }} active onSelect={vi.fn()} />
      </div>,
    );

    await expect.element(page.getByRole('button', { name: '적용' })).toBeVisible();
    const bubble = page.getByTestId('bubble').element().getBoundingClientRect();
    const button = page.getByRole('button', { name: '적용' }).element().getBoundingClientRect();
    expect(button.right).toBeLessThanOrEqual(bubble.right);
  });
});
