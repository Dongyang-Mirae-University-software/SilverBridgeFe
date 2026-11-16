// 가입 2단계 생년월일 칸 - 나이 규칙 안내와 오류(QA AUTH-N04·AUTH-A05). 실제 Chrome에서 돈다
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type { FieldErrors, UseFormRegisterReturn } from 'react-hook-form';

import type { SignupFormValues } from '@/hooks/useSignupForm';
import SignupProfileStep from './SignupProfileStep';

vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

const field = (name: string) => ({ name, onChange: async () => {}, onBlur: async () => {}, ref: () => {} }) as unknown as UseFormRegisterReturn;
const values = { name: '김영희', email: '', password: '', passwordCheck: '', phone: '', verificationNonce: '', role: 'WARD', address: '', addressDetail: '', gender: '', birthDate: '', postcode: '' } as SignupFormValues;

function renderStep(birthDate: string, errors: FieldErrors<SignupFormValues> = {}) {
  return render(
    <SignupProfileStep
      allValues={{ ...values, birthDate }}
      errors={errors}
      isValid={false}
      register={((name: string) => field(name)) as never}
      nameField={field('name')}
      genderField={field('gender')}
      addressField={field('address')}
      addressDetailField={field('addressDetail')}
      birthDateValue={birthDate}
      onBirthDateChange={() => {}}
      postcodeField={field('postcode')}
      onAddressSearch={() => {}}
      onNext={() => {}}
    />,
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('가입 생년월일 칸 (Chrome)', () => {
  it('처음부터 "만 14세 이상만 가입할 수 있어요"를 보인다', async () => {
    await renderStep('');
    await expect.element(page.getByText('만 14세 이상만 가입할 수 있어요')).toBeVisible();
  });

  it('규칙에 어긋나면 안내 대신 이유를 보인다', async () => {
    await renderStep('2020-01-01', { birthDate: { type: 'validate', message: '만 14세 이상만 가입할 수 있어요.' } });
    await expect.element(page.getByText('만 14세 이상만 가입할 수 있어요.')).toBeVisible();
  });
});
