// 아이디 찾기 결과 - 가입일은 응답의 joinedAt으로 보인다(QA AUTH-N18). 실제 Chrome에서 돈다
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import FindEmailResultDisplay from './FindEmailResultDisplay';

vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('아이디 찾기 결과 (Chrome)', () => {
  it('일반 계정의 가입일(joinedAt)을 보인다', async () => {
    await render(<FindEmailResultDisplay result={{ maskedEmail: 'yo***ee@naver.com', hasKakaoAccount: false, joinedAt: '2026-03-02' }} />);

    await expect.element(page.getByText('가입일 2026-03-02')).toBeVisible();
  });
});
