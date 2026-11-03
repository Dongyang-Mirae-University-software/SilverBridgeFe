// 피보호자 홈 - 화면 읽기 프로그램·자동 점검이 찾을 h1. 실제 Chrome에서 돈다(`npm run test:browser`)
import { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { WardHomeContent } from './WardHomeContent';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('WardHomeContent (Chrome)', () => {
  it('보이지 않는 h1 "피보호자 홈"을 두고, 기능 카드는 그대로 보인다', async () => {
    await render(<WardHomeContent />);

    await expect.element(page.getByRole('heading', { name: '피보호자 홈', level: 1 })).toBeInTheDocument();
    await expect.element(page.getByRole('link', { name: '긴급 전화' })).toBeVisible();
  });
});
