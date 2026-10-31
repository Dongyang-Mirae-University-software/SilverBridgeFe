// 로그인 폼 - 실제 Chrome에서 돈다(`npm run test:browser`)
// method="post": 하이드레이션 전 제출이어도 자격이 주소 쿼리로 가지 않게(2026-10-31). 하이드레이션 뒤에는 API로 로그인한다.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import LoginContent from './LoginContent';

const mocks = vi.hoisted(() => ({ signin: vi.fn(), push: vi.fn(), complete: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/service/api/auth/auth', () => ({ signin: mocks.signin }));
vi.mock('@/lib/auth/completeSignin', () => ({ completeSigninSession: mocks.complete }));
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

function renderLogin() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LoginContent />
    </QueryClientProvider>,
  );
}

describe('LoginContent (Chrome)', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(fn => fn.mockReset());
    mocks.signin.mockResolvedValue({ data: { accessToken: 'a', refreshToken: 'r', role: 'GUARDIAN' } });
  });

  it('폼은 POST라 JS 없이 제출돼도 자격이 주소에 실리지 않는다', () => {
    renderLogin();
    const form = document.querySelector('form') as HTMLFormElement;
    expect(form.method).toBe('post');
  });

  it('하이드레이션 뒤에는 페이지 이동 없이 API로 로그인한다(주소 그대로)', async () => {
    const before = window.location.href;
    renderLogin();
    const form = document.querySelector('form') as HTMLFormElement;
    await userEvent.fill(form.querySelector('input[name="email"]') as HTMLInputElement, 'user@test.com');
    await userEvent.fill(form.querySelector('input[name="password"]') as HTMLInputElement, 'pw-1234');
    await userEvent.click(form.querySelector('button[type="submit"]') as HTMLButtonElement);

    await vi.waitFor(() => expect(mocks.signin).toHaveBeenCalledTimes(1));
    expect(mocks.signin.mock.calls[0][0]).toEqual({ email: 'user@test.com', password: 'pw-1234' });
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(window.location.href).toBe(before);
  });
});
