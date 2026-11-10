// 카카오 로그인 콜백 - 이 브라우저가 시작한 로그인(state 난수 = 쿠키)일 때만 인가 코드를 서버로 보내고,
// 신규 회원의 가입 정보는 주소가 아니라 이 탭에만 넘긴다(2026-11-10 전체 점검 S-5·S-6). 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { KakaoCallbackContent } from './KakaoCallbackContent';
import { clearKakaoSignupHandoff, readKakaoSignupHandoff } from '@/lib/auth/kakaoSignupHandoff';

const NONCE = '0123456789abcdef0123456789abcdef';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  signinKakao: vi.fn(),
  completeSigninSession: vi.fn(),
  query: '',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.query),
}));
vi.mock('@/service/api/auth/auth', () => ({ signinKakao: mocks.signinKakao }));
vi.mock('@/lib/auth/completeSignin', () => ({ completeSigninSession: mocks.completeSigninSession }));
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

function renderCallback(query: Record<string, string>) {
  mocks.query = new URLSearchParams(query).toString();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <KakaoCallbackContent />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(mocks).forEach(value => typeof value === 'function' && value.mockReset());
  document.cookie = `careai_oauth_state=${NONCE}; path=/`;
});

afterEach(() => {
  document.cookie = 'careai_oauth_state=; path=/; max-age=0';
  clearKakaoSignupHandoff();
  document.body.innerHTML = '';
});

describe('카카오 로그인 콜백', () => {
  it('state 난수가 쿠키와 같으면 로그인하고 돌아갈 경로로 보낸다. 쿠키는 한 번 쓰고 지운다', async () => {
    mocks.signinKakao.mockResolvedValue({ data: { accessToken: 'a1', refreshToken: 'r1', role: 'GUARDIAN' } });

    await renderCallback({ code: 'c1', state: `${NONCE}:/guardian/wards/register` });

    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/guardian/wards/register'));
    expect(mocks.signinKakao).toHaveBeenCalledTimes(1);
    expect(mocks.completeSigninSession).toHaveBeenCalledWith({ accessToken: 'a1', role: 'GUARDIAN' });
    expect(document.cookie).not.toContain('careai_oauth_state=');
  });

  it('state 가 쿠키와 다르면(남이 만든 콜백 주소) 인가 코드를 서버로 보내지 않고 다시 시도하라고 알린다', async () => {
    await renderCallback({ code: 'attacker-code', state: 'f'.repeat(32) });

    await expect.element(page.getByText('카카오 로그인을 처음부터 다시 시도해주세요.')).toBeVisible();
    expect(mocks.signinKakao).not.toHaveBeenCalled();
    expect(mocks.completeSigninSession).not.toHaveBeenCalled();
  });

  it('state 가 없거나 난수 없는 옛 형식(경로만)이어도 보내지 않는다', async () => {
    await renderCallback({ code: 'c1', state: '/guardian' });

    await expect.element(page.getByText('카카오 로그인을 처음부터 다시 시도해주세요.')).toBeVisible();
    expect(mocks.signinKakao).not.toHaveBeenCalled();
  });

  it('신규 회원이면 가입 정보(pendingToken 포함)를 이 탭에만 넘기고 주소에는 싣지 않는다', async () => {
    mocks.signinKakao.mockResolvedValue({
      data: { isNewUser: true, kakaoId: '123', email: 'kakao_123@kakao.com', pendingToken: 'p-token' },
    });

    await renderCallback({ code: 'c1', state: NONCE });

    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/signup?kakao=1'));
    expect(readKakaoSignupHandoff()).toEqual({
      kakaoId: '123',
      email: 'kakao_123@kakao.com',
      profileImageUrl: undefined,
      pendingToken: 'p-token',
    });
  });

  it('신규 회원인데 pendingToken 이 없으면 가입 화면으로 보내지 않는다(가입 완료가 400으로 실패한다)', async () => {
    mocks.signinKakao.mockResolvedValue({ data: { isNewUser: true, kakaoId: '123', email: 'kakao_123@kakao.com' } });

    await renderCallback({ code: 'c1', state: NONCE });

    await expect.element(page.getByText('카카오 가입 정보를 받지 못했습니다. 다시 시도해주세요.')).toBeVisible();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
