'use client';

import classNames from 'classnames/bind';

import styles from './SignupForm.module.css';
import useContactForm from '@/app/_hook/useSignupForm';
import TextInput from '@/app/_component/common/TextInput';

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

    phoneRules,
    allValues,
  } = useContactForm();

  return (
    <form className={cx('container')} onSubmit={onSubmit}>
      <TextInput
        label={'이메일'}
        placeholder={'입력'}
        required
        {...register('email', emailRules('에러요'))}
        isArrow={false}
        error={Boolean(errors.email && allValues.email && allValues.email.trim() !== '')}
        errorText={errors.email?.message}
      />
      <TextInput
        label={'비밀번호'}
        placeholder={'입력'}
        required
        {...register('password', passwordRules('에러요'))}
        isArrow={false}
        error={Boolean(errors.password && allValues.password && allValues.password.trim() !== '')}
        errorText={errors.password?.message}
      />
      <TextInput
        label={'비밀번호 검증'}
        placeholder={'입력'}
        required
        {...register('passwordCheck', passwordCheckRules('에러요'))}
        isArrow={false}
        error={Boolean(errors.passwordCheck && allValues.passwordCheck && allValues.passwordCheck.trim() !== '')}
        errorText={errors.passwordCheck?.message}
      />
      <TextInput
        label={'이름'}
        placeholder={'입력'}
        required
        {...register('name', textRules('에러요', 2))}
        isArrow={false}
        error={Boolean(errors.name && allValues.name && allValues.name.trim() !== '')}
        errorText={errors.name?.message}
      />
      <TextInput
        label={'폰 번호'}
        placeholder={'입력'}
        required
        {...register('phone', phoneRules('에러요'))}
        isArrow={false}
        error={Boolean(errors.phone && allValues.phone && allValues.phone.trim() !== '')}
        errorText={errors.phone?.message}
      />
      <div>
        <label className={cx('radio')} htmlFor="WARD">
          <input id="WARD" type="radio" value="WARD" {...register('role')} />
          <span>노인</span>
        </label>
        <label className={cx('radio')} htmlFor="guardian">
          <input id="guardian" type="radio" value="guardian" {...register('role')} />
          <span>보호자</span>
        </label>
      </div>

      <button className={cx('button')} type="submit">
        전송
      </button>
    </form>
  );
}
