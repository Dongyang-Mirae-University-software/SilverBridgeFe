import classNames from 'classnames/bind';

import styles from './SignupForm.module.css';
import TextInput from '@/app/_components/common/TextInput';
import useSignupForm from '@/app/_hook/useSignupForm';
import { emailCheck, smsSend, smsVerify } from '@/service/api/auth';
import { useMutation } from '@tanstack/react-query';
import { ChangeEvent, useState } from 'react';

const cx = classNames.bind(styles);

export default function SignupForm() {
  const {
    register,
    onSubmit,
    formState: { errors, isValid },
    getValues,
    setValue,
    emailRules,
    passwordRules,
    passwordCheckRules,
    phoneRules,
    textRules,
    allValues,
  } = useSignupForm();

  const [isEmailCheck, setIsEmailCheck] = useState(false);
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [isSmsCheck, setIsSmsCheck] = useState(false);

  const { mutate: emailCheckMutate } = useMutation({
    mutationKey: ['email-check'],
    mutationFn: emailCheck,
    onError: () => setIsEmailCheck(false),
    onSuccess: () => setIsEmailCheck(true),
  });

  const { mutate: smsSendMutate } = useMutation({
    mutationKey: ['sms-send'],
    mutationFn: smsSend,
    onError: () => {},
    onSuccess: () => setIsCode(true),
  });

  const { mutate: smsVerifyMutate, isError } = useMutation({
    mutationKey: ['sms-verify'],
    mutationFn: smsVerify,
    onError: () => {},
    onSuccess: () => setIsSmsCheck(true),
  });

  const handleEmailCheck = () => {
    setIsEmailTouched(true);
    emailCheckMutate({ email: getValues('email') });
  };

  const handlePhoneCheck = () => {
    smsSendMutate({ phone: getValues('phone') });
  };

  const handleCode = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value.length <= 6) setSmsCode(value);
  };

  const handlePhoneReset = () => {
    setIsCode(false);
    setValue('phone', '');
  };

  const handleSmsVerify = () => {
    smsVerifyMutate({ code: smsCode, phone: getValues('phone') });
  };

  const emailError =
    (errors.email && allValues.email && allValues.email.trim() !== '') ||
    (isEmailTouched && !isEmailCheck && !!getValues('email').length);

  return (
    <form className={cx('container')} onSubmit={onSubmit}>
      <TextInput
        label="이메일"
        placeholder="이메일을 입력해주세요"
        required
        {...register('email', emailRules('이메일 형식이 올바르지 않습니다.'))}
        onBlur={handleEmailCheck}
        error={emailError}
        errorText={emailError ? (errors.email?.message ?? '이메일이 중복되었습니다.') : undefined}
      />
      <TextInput
        label="비밀번호"
        placeholder="비밀번호를 입력하세요"
        required
        {...register('password', passwordRules('비밀번호 형식이 올바르지 않습니다.'))}
        error={Boolean(errors.password && allValues.password && allValues.password.trim() !== '')}
        errorText={errors.password?.message}
      />
      <TextInput
        label="비밀번호 확인"
        placeholder="비밀번호를 다시 입력하세요"
        required
        {...register('passwordCheck', passwordCheckRules('비밀번호가 일치하지 않습니다.'))}
        error={Boolean(errors.passwordCheck && allValues.passwordCheck && allValues.passwordCheck.trim() !== '')}
        errorText={errors.passwordCheck?.message}
      />
      <TextInput
        label="이름"
        placeholder="이름을 입력하세요"
        required
        {...register('name', textRules('이름을 입력하세요.', 2))}
        error={Boolean(errors.name && allValues.name && allValues.name.trim() !== '')}
        errorText={errors.name?.message}
      />
      <TextInput
        label="전화번호"
        placeholder="전화번호를 입력하세요"
        required
        {...register('phone', phoneRules('전화번호 형식이 올바르지 않습니다.'))}
        error={Boolean(errors.phone && allValues.phone && allValues.phone.trim() !== '')}
        disabled={isCode}
        errorText={errors.phone?.message}
      />
      <div className={cx('actionRow')}>
        <button className={cx('secondaryButton')} type="button" onClick={handlePhoneCheck}>
          인증번호 전송
        </button>
        <button className={cx('secondaryButton')} type="button" onClick={handlePhoneReset}>
          재설정
        </button>
      </div>
      {isCode && (
        <>
          <TextInput
            error={Boolean(isError)}
            errorText={isError ? '인증번호가 올바르지 않습니다.' : undefined}
            label="인증번호"
            maxLength={6}
            value={smsCode}
            onChange={handleCode}
            placeholder="인증번호를 입력하세요"
          />
          <button className={cx('secondaryButton')} type="button" onClick={handleSmsVerify}>
            인증 확인
          </button>
        </>
      )}
      <div className={cx('radioGroup')}>
        <label className={cx('radio')} htmlFor="WARD">
          <input id="WARD" type="radio" value="WARD" {...register('role')} defaultChecked />
          <span>노인</span>
        </label>
        <label className={cx('radio')} htmlFor="GUARDIAN">
          <input id="GUARDIAN" type="radio" value="GUARDIAN" {...register('role')} />
          <span>보호자</span>
        </label>
      </div>
      <button className={cx('button')} disabled={!isValid || !isEmailCheck || !isSmsCheck} type="submit">
        회원가입 완료
      </button>
    </form>
  );
}
