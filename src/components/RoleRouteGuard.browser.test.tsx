// 보호 화면 가드 - access 쿠키가 없어도 refresh 토큰이 있으면 로그인 화면 대신 먼저 갱신하고,
// 일시 장애로는 로그아웃시키지 않는다. 실제 Chrome에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { clearAuthTokens, setAuthTokens } from '@/lib/auth/tokenStore';
import RoleRouteGuard from './RoleRouteGuard';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  restoreSession: vi.fn(),
  getMyProfile: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/lib/fcm', () => ({ registerFcmTokenForCurrentDevice: () => Promise.resolve() }));
vi.mock('@/lib/auth/sessionRestore', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth/sessionRestore')>()),
  restoreSession: mocks.restoreSession,
}));
vi.mock('@/service/query/user', () => ({
  myProfileQueryOptions: { queryKey: ['test-my-profile'], queryFn: mocks.getMyProfile, retry: false },
}));

function renderGuard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RoleRouteGuard allowedRole="GUARDIAN">
        <p>보호자 화면</p>
      </RoleRouteGuard>
    </QueryClientProvider>,
  );
}

const profile = { success: true, code: 200, data: { role: 'GUARDIAN' } };

beforeEach(() => {
  clearAuthTokens();
});

afterEach(() => {
  clearAuthTokens();
  mocks.replace.mockReset();
  mocks.restoreSession.mockReset();
  mocks.getMyProfile.mockReset();
});

describe('RoleRouteGuard', () => {
  it('access 쿠키가 없고 refresh 토큰이 있으면 로그인 화면으로 보내지 않고 갱신 후 화면을 연다', async () => {
    // access 쿠키는 없고 refresh 쿠키만 남은 상태(31분 뒤 재방문 / 개발자 도구로 access 쿠키 삭제)
    document.cookie = 'careai_refresh_token=r1; path=/';
    mocks.restoreSession.mockImplementation(async () => {
      setAuthTokens({ accessToken: 'a2', refreshToken: 'r2' });
      return { status: 'restored', homePath: '/guardian' };
    });
    mocks.getMyProfile.mockResolvedValue(profile);

    const screen = renderGuard();

    await expect.element(screen.getByText('보호자 화면')).toBeVisible();
    expect(mocks.restoreSession).toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalledWith('/login');
  });

  it('갱신하는 동안 빈 화면 대신 확인 중 안내를 보인다', async () => {
    document.cookie = 'careai_refresh_token=r1; path=/';
    mocks.restoreSession.mockReturnValue(new Promise(() => {}));

    const screen = renderGuard();

    await expect.element(screen.getByText('로그인 상태를 확인하고 있어요')).toBeVisible();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('복원이 거절되면 로그인 화면으로 보낸다', async () => {
    document.cookie = 'careai_refresh_token=r1; path=/';
    mocks.restoreSession.mockImplementation(async () => {
      clearAuthTokens();
      return { status: 'rejected' };
    });

    renderGuard();

    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'));
  });

  it('복원이 일시 장애면 세션을 지우지 않고 다시 시도 안내 - 다시 시도해 성공하면 화면을 연다', async () => {
    document.cookie = 'careai_refresh_token=r1; path=/';
    mocks.restoreSession.mockResolvedValue({ status: 'unavailable' });
    mocks.getMyProfile.mockResolvedValue(profile);

    const screen = renderGuard();

    await expect.element(screen.getByText('로그인 상태를 확인하지 못했어요')).toBeVisible();
    expect(document.cookie).toContain('careai_refresh_token=r1');
    expect(mocks.replace).not.toHaveBeenCalledWith('/login');

    mocks.restoreSession.mockImplementation(async () => {
      setAuthTokens({ accessToken: 'a2', refreshToken: 'r2' });
      return { status: 'restored', homePath: '/guardian' };
    });
    await screen.getByRole('button', { name: '다시 시도' }).click();

    await expect.element(screen.getByText('보호자 화면')).toBeVisible();
  });

  it('refresh 토큰도 없으면 로그인 화면으로 보낸다', async () => {
    renderGuard();

    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'));
    expect(mocks.restoreSession).not.toHaveBeenCalled();
  });

  it('프로필 조회가 5xx면 세션을 지우지 않고 다시 시도 안내를 보인다', async () => {
    setAuthTokens({ accessToken: 'a1', refreshToken: 'r1', remember: true });
    mocks.getMyProfile.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce(profile);

    const screen = renderGuard();

    await expect.element(screen.getByText('로그인 상태를 확인하지 못했어요')).toBeVisible();
    expect(document.cookie).toContain('careai_refresh_token=r1');
    expect(mocks.replace).not.toHaveBeenCalledWith('/login');

    await screen.getByRole('button', { name: '다시 시도' }).click();
    await expect.element(screen.getByText('보호자 화면')).toBeVisible();
  });

  it('프로필 조회가 403이면 세션을 지우고 로그인 화면으로 보낸다', async () => {
    setAuthTokens({ accessToken: 'a1', refreshToken: 'r1', remember: true });
    mocks.getMyProfile.mockRejectedValue({ response: { status: 403 } });

    renderGuard();

    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'));
    expect(document.cookie).not.toContain('careai_refresh_token');
  });
});
