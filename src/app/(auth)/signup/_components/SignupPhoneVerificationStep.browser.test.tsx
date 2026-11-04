// 회원가입 마지막 단계(전화번호 인증) - 좁은 화면(375px)에서 버튼이 입력칸 옆에 한 줄로 놓이고 커지지 않는지. 실제 Chrome에서 돈다
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { SignupFormValues } from '@/hooks/useSignupForm';
import SignupPhoneVerificationStep from './SignupPhoneVerificationStep';

const values = { phone: '01012345678' } as SignupFormValues;
const field = { name: 'phone', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() } as never;

function renderStep() {
  return render(
    <SignupPhoneVerificationStep
      allValues={values}
      errors={{}}
      phoneField={field}
      smsCode=""
      smsSendErrorMsg=""
      smsVerifyError={null}
      isCode
      isEmailCheck
      isSmsCheck={false}
      isSmsSendPending={false}
      isSmsVerifyPending={false}
      smsTimerKey={0}
      onCodeChange={vi.fn()}
      onPhoneChange={vi.fn()}
      onPhoneCheck={vi.fn()}
      onPhoneReset={vi.fn()}
      onPrevStep={vi.fn()}
      onSmsVerify={vi.fn()}
    />,
  );
}

const box = (name: string) => page.getByRole('button', { name, exact: true }).element().getBoundingClientRect();

describe('전화번호 인증 단계 좁은 화면 (Chrome)', () => {
  it('번호 변경·확인 버튼은 입력칸 옆 한 줄에 48px 높이로, 이전·가입 완료도 한 줄에 놓인다', async () => {
    await renderStep();
    await expect.element(page.getByRole('button', { name: '번호 변경' })).toBeVisible();

    const phone = page.getByLabelText('전화번호').element().getBoundingClientRect();
    expect(box('번호 변경').height).toBe(48);
    expect(box('번호 변경').top).toBeGreaterThanOrEqual(phone.top - 2);
    expect(box('번호 변경').left).toBeGreaterThan(phone.right);
    expect(box('확인').height).toBe(48);
    expect(box('이전').top).toBe(box('가입 완료').top);
  });

  it('누를 수 있는 번호 변경 버튼은 흐리게(반투명) 그리지 않는다', async () => {
    await renderStep();
    await expect.element(page.getByRole('button', { name: '번호 변경' })).toBeEnabled();

    expect(getComputedStyle(page.getByRole('button', { name: '번호 변경' }).element()).opacity).toBe('1');
  });
});
