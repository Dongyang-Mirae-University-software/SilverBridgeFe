// 비밀번호 찾기 새 비밀번호 단계 - 인증 만료 때 다시 받기(QA AUTH-A35). 실제 Chrome에서 돈다
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import FindPasswordResetStep from './FindPasswordResetStep';

vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('새 비밀번호 단계 (Chrome)', () => {
  it('인증이 만료되면 "인증 다시 받기"를 보이고 누르면 처음으로 돌아간다', async () => {
    const onRestart = vi.fn();
    await render(
      <FindPasswordResetStep errorMessage="인증 시간이 지났습니다." isPending={false} isVerificationExpired onRestart={onRestart} onSubmit={vi.fn()} />,
    );

    await expect.element(page.getByText('인증 시간이 지났습니다.')).toBeVisible();
    expect(page.getByRole('button', { name: '비밀번호 변경' }).query()).toBeNull();
    await page.getByRole('button', { name: '인증 다시 받기' }).click();
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('만료가 아니면 지금처럼 비밀번호 변경 버튼만 있다', async () => {
    await render(<FindPasswordResetStep errorMessage="" isPending={false} onSubmit={vi.fn()} />);

    await expect.element(page.getByRole('button', { name: '비밀번호 변경' })).toBeInTheDocument();
    expect(page.getByRole('button', { name: '인증 다시 받기' }).query()).toBeNull();
  });
});
