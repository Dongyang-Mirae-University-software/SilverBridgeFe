// 회원가입 단계 - 이메일 가입은 계정 → 내 정보 → 전화번호 인증 3단계, 카카오 가입은 내 정보 → 전화번호 인증 2단계. 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import SignupContent from './SignupContent';

vi.mock('@/service/api/auth/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('@/service/api/auth/auth')>()),
  signupEmailCheck: vi.fn().mockResolvedValue({ data: {} }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderSignup(searchParams: Record<string, string> = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SignupContent searchParams={searchParams} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('회원가입 단계 (Chrome)', () => {
  it('이메일 가입: 1단계는 계정 칸만, 다음을 누르면 내 정보로 가고 이전으로 돌아와도 입력이 남는다', async () => {
    await renderSignup();

    await expect.element(page.getByText('/ 3 · 계정')).toBeVisible();
    expect(page.getByLabelText('이름').query()).toBeNull();
    const next = page.getByRole('button', { name: '다음' });
    await expect.element(next).toBeDisabled();

    await userEvent.fill(page.getByLabelText('이메일'), 'new@test.com');
    await userEvent.fill(page.getByLabelText('비밀번호', { exact: true }), 'password1!');
    await userEvent.fill(page.getByLabelText('비밀번호 확인'), 'password1!');
    await expect.element(next).toBeEnabled();
    await next.click();

    await expect.element(page.getByText('/ 3 · 내 정보')).toBeVisible();
    await expect.element(page.getByLabelText('이름')).toBeVisible();
    expect(page.getByLabelText('이메일').query()).toBeNull();
    await expect.element(page.getByRole('button', { name: '다음' })).toBeDisabled();

    await page.getByRole('button', { name: '이전', exact: true }).click();
    await expect.element(page.getByLabelText('이메일')).toHaveValue('new@test.com');
  });

  it('카카오 가입: 계정 단계 없이 내 정보(가입 유형 포함)부터 2단계로 진행한다', async () => {
    await renderSignup({ kakaoId: '123', email: 'kakao_123@kakao.com' });

    await expect.element(page.getByText('/ 2 · 내 정보')).toBeVisible();
    await expect.element(page.getByRole('radiogroup', { name: '가입 유형' })).toBeVisible();
    await expect.element(page.getByLabelText('이름')).toBeVisible();
    expect(page.getByLabelText('비밀번호', { exact: true }).query()).toBeNull();
    expect(page.getByRole('button', { name: '이전', exact: true }).query()).toBeNull();
  });
});
