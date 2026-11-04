// /login 진입 시 세션 확인 - 첫 화면(/)과 같은 기준(resolveEntry·restoreSession)으로 이미 로그인한 사람을 들여보낸다.
// 서버 컴포넌트의 cookies()를 이 브라우저의 document.cookie로 바꿔, 로그아웃 등으로 쿠키를 지운 뒤의 진입까지 실제 Chrome에서 확인한다
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { clearAuthTokens, setAuthTokens } from '@/lib/auth/tokenStore';
import { useLogoutMutation } from '@/service/query/auth/mutations';
import LoginPage from './page';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  replace: vi.fn(),
  push: vi.fn(),
  refreshAccessToken: vi.fn(),
  logout: vi.fn(),
}));

// next/headers는 CJS라 Vite가 default로 읽게 바꿔 놓는다 - 목도 default에 같은 함수를 둔다
vi.mock('next/headers', () => {
  const cookies = async () => ({
    get: (name: string) => {
      const pair = document.cookie.split('; ').find(item => item.startsWith(`${name}=`));
      return pair ? { name, value: decodeURIComponent(pair.slice(name.length + 1)) } : undefined;
    },
  });
  return { cookies, default: { cookies } };
});
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/api/apiClient', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/apiClient')>()),
  refreshAccessToken: mocks.refreshAccessToken,
}));
vi.mock('@/service/api/auth/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('@/service/api/auth/auth')>()),
  logout: mocks.logout,
}));
vi.mock('@/lib/fcm', () => ({
  registerFcmTokenForCurrentDevice: () => Promise.resolve(),
  unregisterFcmTokenForCurrentDevice: () => Promise.resolve(),
}));
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

function jwt(claims: { role: string; exp: number }) {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'none' })}.${encode(claims)}.sig`;
}
const validAccess = (role = 'GUARDIAN') => jwt({ role, exp: Math.floor(Date.now() / 1000) + 1800 });
const expiredAccess = (role = 'GUARDIAN') => jwt({ role, exp: Math.floor(Date.now() / 1000) - 60 });

function withClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

async function openLogin(searchParams: { returnTo?: string } = {}) {
  return render(withClient(await LoginPage({ searchParams: Promise.resolve(searchParams) })));
}

const form = () => document.querySelector('form');

beforeEach(() => {
  clearAuthTokens();
  Object.values(mocks).forEach(fn => fn.mockClear());
  mocks.refreshAccessToken.mockReset();
  mocks.logout.mockReset().mockResolvedValue({ data: {} });
});
afterEach(() => {
  clearAuthTokens();
  document.body.innerHTML = '';
});

describe('/login 세션 확인 (Chrome)', () => {
  it('access 토큰이 살아 있으면 폼을 그리지 않고 서버에서 역할 홈으로 보낸다', async () => {
    setAuthTokens({ accessToken: validAccess('WARD'), refreshToken: 'r1' });

    await expect(openLogin()).rejects.toThrow('REDIRECT:/ward');
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('가려던 내부 경로(returnTo)가 있으면 그곳으로, 외부 주소면 역할 홈으로 보낸다', async () => {
    setAuthTokens({ accessToken: validAccess(), refreshToken: 'r1' });

    await expect(openLogin({ returnTo: '/guardian/wards/register?targetId=aB3x9Z' })).rejects.toThrow(
      'REDIRECT:/guardian/wards/register?targetId=aB3x9Z',
    );
    await expect(openLogin({ returnTo: '//evil.example' })).rejects.toThrow('REDIRECT:/guardian');
  });

  it('access가 만료되고 refresh만 있으면 확인 중 안내를 보이고, 갱신되면 역할 홈으로 replace한다', async () => {
    setAuthTokens({ accessToken: expiredAccess(), refreshToken: 'r1' });
    let finishRefresh = () => {};
    mocks.refreshAccessToken.mockImplementation(
      () =>
        new Promise(resolve => {
          finishRefresh = () => {
            const token = validAccess('GUARDIAN');
            setAuthTokens({ accessToken: token, refreshToken: 'r2' });
            resolve(token);
          };
        }),
    );

    await openLogin();

    await expect.element(page.getByText('로그인 상태를 확인하고 있어요')).toBeInTheDocument();
    expect(form()).toBeNull();

    finishRefresh();
    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/guardian'));
    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(form()).toBeNull();
  });

  it('access 쿠키 없이 refresh만 남아도(로그인 유지 후 브라우저 재시작) 갱신해서 들어간다', async () => {
    document.cookie = 'careai_refresh_token=r1; path=/';
    mocks.refreshAccessToken.mockImplementation(async () => {
      const token = validAccess('WARD');
      setAuthTokens({ accessToken: token, refreshToken: 'r2' });
      return token;
    });

    await openLogin();

    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/ward'));
  });

  it('갱신이 거절되면(다른 기기 로그인 등) 오류 문구 없이 로그인 폼을 보인다', async () => {
    setAuthTokens({ accessToken: expiredAccess(), refreshToken: 'r1' });
    // 실제 refreshAccessToken 처럼 거절(401·403·404)이면 세션을 지우고 던진다
    mocks.refreshAccessToken.mockImplementation(async () => {
      clearAuthTokens();
      throw Object.assign(new Error('rejected'), { response: { status: 401 } });
    });

    await openLogin();

    await vi.waitFor(() => expect(form()).not.toBeNull());
    expect(page.getByRole('alert').elements()).toHaveLength(0);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain('careai_refresh_token');
  });

  it('일시 장애(5xx)면 로그인 폼을 보이되 세션은 지우지 않는다', async () => {
    setAuthTokens({ accessToken: expiredAccess(), refreshToken: 'r1' });
    mocks.refreshAccessToken.mockRejectedValue(Object.assign(new Error('unavailable'), { response: { status: 503 } }));

    await openLogin();

    await vi.waitFor(() => expect(form()).not.toBeNull());
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(document.cookie).toContain('careai_refresh_token=r1');
  });

  it('토큰이 없으면 확인 없이 바로 폼을 보인다', async () => {
    await openLogin();

    expect(form()).not.toBeNull();
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
  });
});

function LogoutButton() {
  const { mutate } = useLogoutMutation();
  return (
    <button type="button" onClick={() => mutate()}>
      로그아웃
    </button>
  );
}

describe('로그아웃 (Chrome)', () => {
  it('서버 응답을 기다리지 않고 바로 세션을 지우고 로그인 화면으로 보낸다', async () => {
    const access = validAccess();
    setAuthTokens({ accessToken: access, refreshToken: 'r1' });
    mocks.logout.mockReturnValue(new Promise(() => {}));
    await render(withClient(<LogoutButton />));

    await userEvent.click(page.getByRole('button', { name: '로그아웃' }));

    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'));
    expect(document.cookie).not.toContain('careai_access_token=');
    // 지우기 전에 꺼내 둔 토큰으로 서버 로그아웃을 뒤에서 보낸다
    await vi.waitFor(() => expect(mocks.logout).toHaveBeenCalledWith(access));
  });
});

describe('세션을 끝낸 뒤 /login (Chrome)', () => {
  it('로그아웃 직후 /login은 폼을 보이고 홈으로 튕기지 않는다', async () => {
    setAuthTokens({ accessToken: validAccess(), refreshToken: 'r1' });
    await render(withClient(<LogoutButton />));

    await userEvent.click(page.getByRole('button', { name: '로그아웃' }));
    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'));
    document.body.innerHTML = '';
    mocks.replace.mockClear();

    await openLogin();

    expect(form()).not.toBeNull();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  // 비밀번호 변경·회원 탈퇴도 clearAuthTokens() 뒤 router.replace('/login') 한다(PasswordChangeSection·AccountDeleteSection)
  it.each([
    ['로그인 유지', true],
    ['로그인 유지 해제', false],
  ])('비밀번호 변경·탈퇴로 토큰을 지운 뒤(%s) /login은 폼을 보인다', async (_label, remember) => {
    setAuthTokens({ accessToken: validAccess(), refreshToken: 'r1', remember });
    clearAuthTokens();

    await openLogin();

    expect(form()).not.toBeNull();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
  });
});
