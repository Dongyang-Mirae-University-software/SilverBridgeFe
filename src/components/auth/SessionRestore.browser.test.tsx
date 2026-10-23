// 첫 진입 세션 복원 화면 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 갱신 성공 → 역할 홈 / 거절 → 로그인 / 일시 장애 → 세션을 지우지 않고 "다시 시도" 안내

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import SessionRestore from './SessionRestore';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  restoreSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/lib/auth/sessionRestore', () => ({ restoreSession: mocks.restoreSession }));

afterEach(() => {
  mocks.replace.mockReset();
  mocks.restoreSession.mockReset();
});

describe('SessionRestore', () => {
  it('갱신에 성공하면 역할 홈으로 보낸다', async () => {
    mocks.restoreSession.mockResolvedValue({ status: 'restored', homePath: '/ward' });

    render(<SessionRestore />);

    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/ward'));
  });

  it('세션이 거절되면 로그인 화면으로 보낸다', async () => {
    mocks.restoreSession.mockResolvedValue({ status: 'rejected' });

    render(<SessionRestore />);

    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'));
  });

  it('일시 장애면 로그인 화면으로 보내지 않고 다시 시도 안내를 보인다', async () => {
    mocks.restoreSession.mockResolvedValue({ status: 'unavailable' });

    const screen = render(<SessionRestore />);

    await expect.element(screen.getByText('로그인 상태를 확인하지 못했어요')).toBeVisible();
    expect(mocks.replace).not.toHaveBeenCalled();

    mocks.restoreSession.mockResolvedValue({ status: 'restored', homePath: '/guardian' });
    await screen.getByRole('button', { name: '다시 시도' }).click();

    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/guardian'));
  });
});
