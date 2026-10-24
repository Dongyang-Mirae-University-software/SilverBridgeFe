// 로그인·가입 틀 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { page } from '@vitest/browser/context';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import AuthShell from './AuthShell';

describe('AuthShell (Chrome)', () => {
  afterEach(async () => {
    document.body.innerHTML = '';
    await page.viewport(375, 812);
  });

  // 데스크톱에서는 .formPane이 화면 높이로 잘려 안쪽에서 스크롤된다. 숨긴 input이 기준 부모 없이 놓여도
  // 그 안에 갇혀 바깥 문서를 늘리지 않아야 한다 (FE #114의 빈 띠와 같은 실수의 안전망, 2026-10-24 점검 L-2)
  it('데스크톱에서 기준 부모 없는 absolute 요소가 아래쪽에 있어도 바깥 문서는 내용보다 길어지지 않는다', async () => {
    await page.viewport(1366, 768);
    document.body.style.margin = '0';
    const screen = render(
      <AuthShell>
        <div style={{ height: '3000px' }} />
        <input aria-label="숨긴 선택" type="checkbox" style={{ position: 'absolute', opacity: 0 }} />
      </AuthShell>,
    );
    const hidden = screen.getByRole('checkbox', { name: '숨긴 선택' });
    await expect.element(hidden).toBeInTheDocument();

    // 숨긴 input이 문서 기준이면 안쪽 스크롤에 갇히지 않고 원래 자리(3000px 아래)에서 문서를 늘린다
    const shell = document.querySelector('main') as HTMLElement;
    expect(hidden.element().getBoundingClientRect().top).toBeGreaterThan(shell.getBoundingClientRect().bottom);
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(Math.ceil(shell.getBoundingClientRect().bottom));
  });
});
