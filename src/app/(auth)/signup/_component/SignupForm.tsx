import classNames from 'classnames/bind';

import styles from './SignupForm.module.css';
import useContactForm from '@/app/_hook/useSignupForm';
import TextInput from '@/app/_component/common/TextInput';
import useSignupForm from '@/app/_hook/useSignupForm';
import { emailCheck } from '@/service/api/auth';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { FocusEventHandler } from 'react';

import { useState } from 'react';

const cx = classNames.bind(styles);

export default function SignupForm() {
  const {
    register,
    formState: { errors, isValid },
    onSubmit,
    emailRules,
    textRules,
    passwordRules,
    passwordCheckRules,
    getValues,
    phoneRules,
    allValues,
  } = useSignupForm();

  const router = useRouter();
  const [isCheck, serIsCheck] = useState<boolean>(false);

  const { mutate } = useMutation({
    mutationKey: ['eamaill-verify'],
    mutationFn: emailCheck,
    onError: () => {},
    onSuccess: () => {
      // router.push('/');
      serIsCheck(true);
    },
  });

  const handleEmailCheck = () => {
    mutate({ email: getValues('email') });
  };

  return (
    <form className={cx('container')} onSubmit={onSubmit}>
      <TextInput
        label={'이메일'}
        placeholder={'이메일을 입력 해주세요'}
        required
        {...register('email', emailRules('에러요'))}
        onBlur={handleEmailCheck}
        error={Boolean(errors.email && allValues.email && allValues.email.trim() !== '') || !isCheck}
        errorText={errors.email?.message ?? '이메일이 중복 오류'}
      />
      <TextInput
        label={'비밀번호'}
        placeholder={'입력'}
        required
        {...register('password', passwordRules('에러요'))}
        error={Boolean(errors.password && allValues.password && allValues.password.trim() !== '')}
        errorText={errors.password?.message}
      />
      <TextInput
        label={'비밀번호 검증'}
        placeholder={'입력'}
        required
        {...register('passwordCheck', passwordCheckRules('에러요'))}
        error={Boolean(errors.passwordCheck && allValues.passwordCheck && allValues.passwordCheck.trim() !== '')}
        errorText={errors.passwordCheck?.message}
      />
      <TextInput
        label={'이름'}
        placeholder={'입력'}
        required
        {...register('name', textRules('에러요', 2))}
        error={Boolean(errors.name && allValues.name && allValues.name.trim() !== '')}
        errorText={errors.name?.message}
      />
      <TextInput
        label={'폰 번호'}
        placeholder={'입력'}
        required
        {...register('phone', phoneRules('에러요'))}
        error={Boolean(errors.phone && allValues.phone && allValues.phone.trim() !== '')}
        errorText={errors.phone?.message}
      />
      <div>
        <label className={cx('radio')} htmlFor="WARD">
          <input id="WARD" type="radio" value="WARD" {...register('role')} defaultChecked />
          <span>노인</span>
        </label>
        <label className={cx('radio')} htmlFor="guardian">
          <input id="guardian" type="radio" value="guardian" {...register('role')} />
          <span>보호자</span>
        </label>
      </div>

      <button className={cx('button')} disabled={!isValid && isCheck} type="submit">
        회원가입 완료
      </button>
    </form>
  );
}
