import classNames from 'classnames/bind';

import styles from './SignupForm.module.css';
import TextInput from '@/app/_components/common/TextInput';
import useSignupForm from '@/app/_hook/useSignupForm';
import { emailCheck, smsSend, smsVerify } from '@/service/api/auth';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ChangeEvent } from 'react';

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
    setValue,
  } = useSignupForm();

  const router = useRouter();
  const [isEmailCheck, setIsEmailCheck] = useState<boolean>(false);

  const [isCode, setIsCode] = useState<boolean>(false);
  const [smsCode, setSmsCode] = useState<string>('');
  const [isSmsCheck, setIsSmsCheck] = useState<boolean>(false);

  const { mutate } = useMutation({
    mutationKey: ['eamaill-check'],
    mutationFn: emailCheck,
    onError: () => {
      setIsEmailCheck(false);
    },
    onSuccess: () => {
      setIsEmailCheck(true);
    },
  });

  const { mutate: smsSendMutate } = useMutation({
    mutationKey: ['sms-send'],
    mutationFn: smsSend,
    onError: () => {},
    onSuccess: () => {
      setIsCode(true);
    },
  });

  const { mutate: smsVerifyMutate, isError } = useMutation({
    mutationKey: ['sms-verify'],
    mutationFn: smsVerify,
    onError: () => {},
    onSuccess: () => {
      setIsSmsCheck(true);
    },
  });

  const handleEmailCheck = () => {
    mutate({ email: getValues('email') });
  };

  const handlePhoneCheck = () => {
    smsSendMutate({ phone: getValues('phone') });
  };

  const handleCode = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (smsCode.length <= 6) setSmsCode(value);
  };

  const handlePhoneReset = () => {
    setIsCode(false);
    setValue('phone', '');
  };

  const handleSmsVerify = () => {
    smsVerifyMutate({ code: smsCode, phone: getValues('phone') });
  };

  return (
    <form className={cx('container')} onSubmit={onSubmit}>
      <TextInput
        label={'이메일'}
        placeholder={'이메일을 입력 해주세요'}
        required
        {...register('email', emailRules('에러요'))}
        onBlur={handleEmailCheck}
        error={
          Boolean(errors.email && allValues.email && allValues.email.trim() !== '') ||
          (!isEmailCheck && !!getValues('email').length)
        }
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
        disabled={isCode}
        errorText={errors.phone?.message}
      />
      <button type="button" onClick={handlePhoneCheck}>
        전송
      </button>
      <button type="button" onClick={handlePhoneReset}>
        X
      </button>
      {isCode && (
        <>
          <TextInput
            error={Boolean(isError)}
            errorText="틀렸어요"
            label="code"
            maxLength={6}
            value={smsCode}
            onChange={handleCode}
            placeholder="코드를 입력하세요."
          />
          <button type="button" onClick={handleSmsVerify}>
            코드 인증
          </button>
        </>
      )}
      <div>
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
