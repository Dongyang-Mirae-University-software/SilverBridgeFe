// 계정 찾기·비밀번호 재설정 폼 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 폼은 method="post"(하이드레이션 전 제출 시 값이 주소 쿼리로 가지 않게)이고,
// 하이드레이션 뒤에는 페이지 이동 없이 API로 처리한다(2026-10-31 점검 L-1).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import FindEmailContent from './find-email/_components/FindEmailContent';
import FindPasswordContent from './find-password/_components/FindPasswordContent';
import FindPasswordResetStep from './find-password/_components/FindPasswordResetStep';

const api = vi.hoisted(() => ({
  findEmail: vi.fn(),
  findPasswordEmailSend: vi.fn(),
  findPasswordEmailVerify: vi.fn(),
  findPasswordEmailResend: vi.fn(),
  findPasswordSmsSend: vi.fn(),
  findPasswordSmsVerify: vi.fn(),
  findPasswordSmsResend: vi.fn(),
  passwordReset: vi.fn(),
}));

vi.mock('@/service/api/auth/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('@/service/api/auth/auth')>()),
  ...api,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

function renderWithClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const form = () => document.querySelector('form') as HTMLFormElement;
const input = (name: string) => form().querySelector(`input[name="${name}"]`) as HTMLInputElement;
const submit = () => userEvent.click(form().querySelector('button[type="submit"]') as HTMLButtonElement);

let before = '';
beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset().mockResolvedValue({ data: {} }));
  before = window.location.href;
});
afterEach(() => {
  expect(window.location.href).toBe(before);
  document.body.innerHTML = '';
});

describe('계정 찾기·비밀번호 재설정 폼 제출 (Chrome)', () => {
  it('이메일 찾기: POST 폼이고 제출하면 이동 없이 API를 부른다', async () => {
    renderWithClient(<FindEmailContent />);
    expect(form().method).toBe('post');
    await userEvent.fill(input('name'), '김영희');
    await userEvent.fill(input('phone'), '01012345678');
    await submit();
    await vi.waitFor(() => expect(api.findEmail).toHaveBeenCalledTimes(1));
  });

  it('비밀번호 찾기(이메일): POST 폼이고 제출하면 이동 없이 API를 부른다', async () => {
    renderWithClient(<FindPasswordContent />);
    await userEvent.click(page.getByRole('button', { name: /이메일 인증/ }));
    await vi.waitFor(() => expect(form()).toBeTruthy());
    expect(form().method).toBe('post');
    await userEvent.fill(input('email'), 'user@test.com');
    await submit();
    await vi.waitFor(() => expect(api.findPasswordEmailSend).toHaveBeenCalledTimes(1));
    expect(api.findPasswordEmailSend.mock.calls[0][0]).toEqual({ email: 'user@test.com' });
  });

  it('비밀번호 찾기(휴대폰): POST 폼이고 제출하면 이동 없이 API를 부른다', async () => {
    renderWithClient(<FindPasswordContent />);
    await userEvent.click(page.getByRole('button', { name: /SMS 인증/ }));
    await vi.waitFor(() => expect(form()).toBeTruthy());
    expect(form().method).toBe('post');
    await userEvent.fill(input('name'), '김영희');
    await userEvent.fill(input('phone'), '01012345678');
    await submit();
    await vi.waitFor(() => expect(api.findPasswordSmsSend).toHaveBeenCalledTimes(1));
  });

  it('새 비밀번호: POST 폼이고 제출하면 이동 없이 새 비밀번호를 넘긴다', async () => {
    const onSubmit = vi.fn();
    render(<FindPasswordResetStep errorMessage="" isPending={false} onSubmit={onSubmit} />);
    expect(form().method).toBe('post');
    await userEvent.fill(input('newPassword'), 'abcd1234!');
    await userEvent.fill(input('confirmPassword'), 'abcd1234!');
    await submit();
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith('abcd1234!'));
  });
});
