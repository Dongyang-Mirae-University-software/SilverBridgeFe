// 회원가입 1단계 이메일 중복 확인 - 실제 Chrome에서 돈다(`npm run test:browser`)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import SignupForm from './SignupForm';

const api = vi.hoisted(() => ({
  signupEmailCheck: vi.fn(),
  signupSmsSend: vi.fn(),
  signupSmsVerify: vi.fn(),
  signup: vi.fn(),
  signupKakao: vi.fn(),
}));

vi.mock('@/service/api/auth/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('@/service/api/auth/auth')>()),
  ...api,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

function renderSignup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SignupForm step={1} onStepChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

const emailInput = () => page.getByLabelText('이메일');

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset().mockResolvedValue({ data: {} }));
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('회원가입 이메일 중복 확인 (Chrome)', () => {
  it('중복으로 실패한 이메일을 고치기 시작하면 지난 오류를 지운다', async () => {
    api.signupEmailCheck.mockRejectedValueOnce(new Error('이미 가입된 이메일입니다.'));
    renderSignup();

    await userEvent.fill(emailInput(), 'taken@test.com');
    await userEvent.click(page.getByLabelText('이름'));
    await expect.element(page.getByText('이미 가입된 이메일입니다.')).toBeInTheDocument();

    await userEvent.fill(emailInput(), 'taken@test.co');
    await expect.element(page.getByText('이미 가입된 이메일입니다.')).not.toBeInTheDocument();
    expect(page.getByText('이메일이 중복되었습니다.').elements()).toHaveLength(0);
  });

  it('확인을 통과한 뒤 이메일을 바꿔도 중복 오류를 띄우지 않는다', async () => {
    renderSignup();

    await userEvent.fill(emailInput(), 'new@test.com');
    await userEvent.click(page.getByLabelText('이름'));
    await vi.waitFor(() => expect(api.signupEmailCheck).toHaveBeenCalledTimes(1));

    await userEvent.fill(emailInput(), 'new2@test.com');
    expect(page.getByText('이메일이 중복되었습니다.').elements()).toHaveLength(0);
  });

  it('형식이 틀린 이메일은 중복 확인 API를 부르지 않는다', async () => {
    renderSignup();

    await userEvent.fill(emailInput(), 'not-an-email');
    await userEvent.click(page.getByLabelText('이름'));
    await expect.element(page.getByText('이메일 형식이 올바르지 않습니다.')).toBeInTheDocument();
    expect(api.signupEmailCheck).not.toHaveBeenCalled();
  });
});
