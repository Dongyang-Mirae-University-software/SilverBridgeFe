// 로그인·가입 틀 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { page } from '@vitest/browser/context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import AuthShell from './AuthShell';

// next/image 는 테스트 브라우저에서 Next 런타임(process.env)을 찾아 파일을 불러오지도 못하므로 일반 img로 바꾼다
// (next/link 를 바꾸는 WardGuardianCallSection 테스트와 같은 방식). 이 테스트는 레이아웃만 보므로 크기·주소만 넘긴다.
// next/image 는 CommonJS로 미리 묶여(optimizeDeps) __esModule 표시가 없으면 default 가 한 겹 더 감싸여 들어온다.
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src, width, height }: { alt: string; src: string; width?: number; height?: number }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} width={width} height={height} />
  ),
}));
// SVG 아이콘은 테스트 번들에서 컴포넌트가 아니라 객체로 들어온다 - 설정 화면 테스트들과 같은 방식으로 바꾼다
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

describe('AuthShell (Chrome)', () => {
  afterEach(async () => {
    document.body.innerHTML = '';
    await page.viewport(375, 812);
  });

  // 숨긴 input처럼 absolute 요소가 틀(main) 밖으로 밀려나도 바깥 문서를 늘리면 안 된다 - 늘면 화면 아래에 빈 띠가
  // 생긴다(FE #114, 2026-10-24 점검 L-2). v11 레이아웃(aa2c346)부터 데스크톱 틀은 안쪽에서 스크롤되지 않고 내용만큼
  // 늘어나므로, 틀 안의 기준 부모(.shell·.content·.formPane·.card의 relative)와 틀의 overflow:hidden이 잘라 주는지를 본다.
  // 변이 확인: 틀의 overflow:hidden을 빼거나 기준 부모 넷을 모두 빼면 문서가 5000px 넘게 늘어나 실패한다.
  it('데스크톱에서 틀 밖으로 밀려난 absolute 요소가 있어도 바깥 문서는 틀보다 길어지지 않는다', async () => {
    await page.viewport(1366, 768);
    document.body.style.margin = '0';
    const screen = render(
      <AuthShell>
        <div style={{ height: '3000px' }} />
        <input aria-label="숨긴 선택" type="checkbox" style={{ position: 'absolute', top: '5000px', opacity: 0 }} />
      </AuthShell>,
    );
    const hidden = screen.getByRole('checkbox', { name: '숨긴 선택' });
    await expect.element(hidden).toBeInTheDocument();

    const shell = document.querySelector('main') as HTMLElement;
    const shellBottom = shell.getBoundingClientRect().bottom;
    // 전제: 숨긴 input은 틀 바닥보다 아래로 밀려나 있다
    expect(hidden.element().getBoundingClientRect().top).toBeGreaterThan(shellBottom);
    // 그래도 바깥 문서는 틀보다 길어지지 않는다 - 빈 띠 없음
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(Math.ceil(shellBottom));
  });
});
