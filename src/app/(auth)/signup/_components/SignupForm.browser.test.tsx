// 회원가입 1단계(계정) 이메일 중복 확인 - 실제 Chrome에서 돈다(`npm run test:browser`)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import useSignupForm from '@/hooks/useSignupForm';
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
const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => nav }));

function renderSignup(step: 'account' | 'phone' = 'account') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SignupForm step={step} onNext={vi.fn()} onPrev={vi.fn()} />
    </QueryClientProvider>,
  );
}

const emailInput = () => page.getByLabelText('이메일');

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset().mockResolvedValue({ data: {} }));
  Object.values(nav).forEach(fn => fn.mockReset());
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('회원가입 이메일 중복 확인 (Chrome)', () => {
  it('중복으로 실패한 이메일을 고치기 시작하면 지난 오류를 지운다', async () => {
    api.signupEmailCheck.mockRejectedValueOnce(new Error('이미 가입된 이메일입니다.'));
    await renderSignup();

    await userEvent.fill(emailInput(), 'taken@test.com');
    await userEvent.click(page.getByLabelText('비밀번호', { exact: true }));
    await expect.element(page.getByText('이미 가입된 이메일입니다.')).toBeInTheDocument();

    await userEvent.fill(emailInput(), 'taken@test.co');
    await expect.element(page.getByText('이미 가입된 이메일입니다.')).not.toBeInTheDocument();
    expect(page.getByText('이메일이 중복되었습니다.').elements()).toHaveLength(0);
  });

  it('확인을 통과한 뒤 이메일을 바꿔도 중복 오류를 띄우지 않는다', async () => {
    await renderSignup();

    await userEvent.fill(emailInput(), 'new@test.com');
    await userEvent.click(page.getByLabelText('비밀번호', { exact: true }));
    await vi.waitFor(() => expect(api.signupEmailCheck).toHaveBeenCalledTimes(1));

    await userEvent.fill(emailInput(), 'new2@test.com');
    expect(page.getByText('이메일이 중복되었습니다.').elements()).toHaveLength(0);
  });

  it('이미 확인한 같은 이메일은 칸을 다시 나가도 또 부르지 않는다 (QA AUTH-A57)', async () => {
    await renderSignup();

    await userEvent.fill(emailInput(), 'new@test.com');
    await userEvent.click(page.getByLabelText('비밀번호', { exact: true }));
    await vi.waitFor(() => expect(api.signupEmailCheck).toHaveBeenCalledTimes(1));

    await userEvent.click(emailInput());
    await userEvent.click(page.getByLabelText('비밀번호', { exact: true }));
    expect(api.signupEmailCheck).toHaveBeenCalledTimes(1);
  });

  it('형식이 틀린 이메일은 중복 확인 API를 부르지 않는다', async () => {
    await renderSignup();

    await userEvent.fill(emailInput(), 'not-an-email');
    await userEvent.click(page.getByLabelText('비밀번호', { exact: true }));
    await expect.element(page.getByText('이메일 형식이 올바르지 않습니다.')).toBeInTheDocument();
    expect(api.signupEmailCheck).not.toHaveBeenCalled();
  });
});

describe('회원가입 전화번호 (QA AUTH-A57, Chrome)', () => {
  it('하이픈 넣은 번호를 붙여넣어도 숫자 11자리가 온전히 들어간다', async () => {
    await renderSignup('phone');
    const phone = page.getByLabelText('전화번호');

    // fill 은 붙여넣기처럼 값을 한 번에 넣는다 - 칸 길이 제한(maxLength)이 먼저 자르는지 본다
    await userEvent.fill(phone, '010-1234-5678');

    await expect.element(phone).toHaveValue('01012345678');
  });

  it('발송이 실패한 뒤 번호를 바꾸면 지난 오류 문구를 지운다', async () => {
    api.signupSmsSend.mockRejectedValueOnce(new Error('발송 한도를 넘었습니다.'));
    await renderSignup('phone');

    await userEvent.fill(page.getByLabelText('전화번호'), '01012345678');
    await page.getByRole('button', { name: /인증/ }).first().click();
    await expect.element(page.getByText('발송 한도를 넘었습니다.')).toBeInTheDocument();

    await userEvent.fill(page.getByLabelText('전화번호'), '01012345679');
    await expect.element(page.getByText('발송 한도를 넘었습니다.')).not.toBeInTheDocument();
  });
});

// 주소 검색(새 창)·SMS 인증은 화면으로 끝까지 갈 수 없어 가입 요청 부분만 훅으로 확인한다
function SignupSubmitHarness() {
  const { setValue, onSubmit, isSignupCompleted } = useSignupForm();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValue('name', '김영희');
          setValue('email', 'new@test.com');
          setValue('password', 'abcd1234!');
          setValue('phone', '01012345678');
          setValue('verificationNonce', 'nonce');
          void onSubmit();
        }}
      >
        가입 요청
      </button>
      {isSignupCompleted && <p>가입 완료</p>}
    </>
  );
}

describe('이메일 회원가입 완료 (Chrome)', () => {
  it('가입에 성공하면 바로 이동하지 않고 완료 안내를 먼저 띄운다', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    await render(
      <QueryClientProvider client={client}>
        <SignupSubmitHarness />
      </QueryClientProvider>,
    );

    await userEvent.click(page.getByRole('button', { name: '가입 요청' }));
    await vi.waitFor(() => expect(api.signup).toHaveBeenCalledTimes(1));
    await expect.element(page.getByText('가입 완료')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('가입 요청을 빠르게 두 번 보내도 요청은 한 번만 나간다 (QA AUTH-A10)', async () => {
    let finish: () => void = () => {};
    api.signup.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    await render(
      <QueryClientProvider client={client}>
        <SignupSubmitHarness />
      </QueryClientProvider>,
    );

    const button = page.getByRole('button', { name: '가입 요청' });
    await userEvent.dblClick(button);
    await vi.waitFor(() => expect(api.signup).toHaveBeenCalledTimes(1));
    finish();
    await expect.element(page.getByText('가입 완료')).toBeInTheDocument();
    expect(api.signup).toHaveBeenCalledTimes(1);
  });
});
