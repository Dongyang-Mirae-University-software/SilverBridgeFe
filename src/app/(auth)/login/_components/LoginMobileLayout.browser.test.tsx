// 로그인 화면 핸드폰 전용 배치(767px 이하, Claude Design 시안) - 실제 Chrome에서 돈다(`npm run test:browser`)
// 동작은 LoginContent.browser.test.tsx 가 본다. 여기서는 화면 폭에 따른 배치만 본다.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { page } from '@vitest/browser/context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import AuthShell from '../../_components/AuthShell';
import LoginContent from './LoginContent';

// next/image·Icon 은 AuthShell 테스트와 같은 이유로 바꾼다(테스트 브라우저에 Next 런타임 없음, SVG는 객체로 들어옴)
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src, width, height, className }: { alt: string; src: string; width?: number; height?: number; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} src={src} width={width} height={height} />
  ),
}));
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/service/api/auth/auth', () => ({ signin: vi.fn() }));
vi.mock('@/lib/auth/completeSignin', () => ({ completeSigninSession: vi.fn() }));

function renderLoginScreen() {
  document.body.style.margin = '0';
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AuthShell>
        <LoginContent />
      </AuthShell>
    </QueryClientProvider>,
  );
}

const isShown = (el: Element | null) => !!el && getComputedStyle(el).display !== 'none';
const appIcon = () => document.querySelector('img[src="/images/careai-icon.png"]');
const features = () => document.querySelector('[class*="features"]');
const subtitle = () => [...document.querySelectorAll('p')].find(p => p.textContent?.includes('다시 오신 것을 환영해요')) ?? null;

describe('로그인 화면 핸드폰 배치 (Chrome)', () => {
  afterEach(async () => {
    document.body.innerHTML = '';
    await page.viewport(375, 812);
  });

  it('767px 이하: 앱 아이콘이 보이고 기능 아이콘 줄·부제는 숨는다', async () => {
    await page.viewport(375, 667);
    renderLoginScreen();
    await vi.waitFor(() => expect(appIcon()).not.toBeNull());

    expect(isShown(appIcon())).toBe(true);
    expect(isShown(features())).toBe(false);
    expect(isShown(subtitle())).toBe(false);
  });

  it('767px 이하: 카드 요소가 시안 순서대로 놓인다', async () => {
    await page.viewport(375, 667);
    const screen = renderLoginScreen();
    await expect.element(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument();

    const card = document.querySelector('[data-auth-screen="login"]')?.closest('[class*="card"]') as HTMLElement;
    const order = [
      '로그인',
      '이메일',
      '비밀번호',
      '로그인 유지',
      '아이디 찾기',
      '비밀번호 찾기',
      '간편 로그인',
      '카카오로 로그인',
      '회원가입',
    ];
    const text = card.innerText.replace(/\s+/g, ' ');
    let from = 0;
    for (const label of order) {
      const at = text.indexOf(label, from);
      expect(at, `${label} 위치`).toBeGreaterThanOrEqual(from);
      from = at + label.length;
    }
    // 로그인 유지와 찾기 링크는 한 줄(같은 높이)에 놓인다
    const remember = screen.getByText('로그인 유지').element().getBoundingClientRect();
    const find = screen.getByRole('button', { name: '아이디 찾기' }).element().getBoundingClientRect();
    expect(Math.abs(remember.top + remember.height / 2 - (find.top + find.height / 2))).toBeLessThan(6);
  });

  it('375×667(아이폰 SE)에서 세로·가로 스크롤 없이 한 화면에 들어간다', async () => {
    await page.viewport(375, 667);
    const screen = renderLoginScreen();
    await expect.element(screen.getByRole('button', { name: '회원가입' })).toBeInTheDocument();

    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(667);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
  });

  it('768px 이상: 지금 화면 그대로 - 앱 아이콘은 숨고 기능 아이콘 줄·부제가 보인다', async () => {
    await page.viewport(1280, 800);
    renderLoginScreen();
    await vi.waitFor(() => expect(appIcon()).not.toBeNull());

    expect(isShown(appIcon())).toBe(false);
    expect(isShown(features())).toBe(true);
    expect(isShown(subtitle())).toBe(true);
  });
});
