import classNames from 'classnames/bind';
import { useForm } from 'react-hook-form';

import styles from './SignupForm.module.css';
import TextInput from '@/app/_components/common/TextInput';
import { emailCheck, smsSend, smsVerify, signup, signupKakao } from '@/service/api/auth';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ChangeEvent } from 'react';
import { useState } from 'react';
import { EMAIL_PATTRERN, PASSWORD_PATTRERN, PHONE_PATTRERN } from '@/app/constant/pattern';
import { RoleType } from '@/service/interface/auth';

const cx = classNames.bind(styles);

interface KakaoData {
  kakaoId: string;
  email: string;
  name: string;
  profileImageUrl?: string;
}

interface SignupFormProps {
  isKakao?: boolean;
  kakaoData?: KakaoData;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  passwordCheck: string;
  phone: string;
  role: RoleType;
  address: string;
  addressDetail: string;
}

export default function SignupForm({ isKakao = false, kakaoData }: SignupFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
    getValues,
  } = useForm<FormData>({
    mode: 'all',
    defaultValues: {
      name: kakaoData?.name || '',
      email: kakaoData?.email || '',
      password: '',
      passwordCheck: '',
      phone: '',
      role: 'WARD',
      address: '',
      addressDetail: '',
    },
  });

  const allValues = watch();

  const [isEmailCheck, setIsEmailCheck] = useState<boolean>(isKakao);
  const [isCode, setIsCode] = useState<boolean>(false);
  const [smsCode, setSmsCode] = useState<string>('');
  const [isSmsCheck, setIsSmsCheck] = useState<boolean>(false);

  const { mutate: emailCheckMutate } = useMutation({
    mutationKey: ['email-check'],
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

  const { mutate: signupMutate } = useMutation({
    mutationKey: ['signup'],
    mutationFn: signup,
    onSuccess: () => {
      router.push('/');
    },
    onError: () => {},
  });

  const { mutate: signupKakaoMutate } = useMutation({
    mutationKey: ['signup-kakao'],
    mutationFn: signupKakao,
    onSuccess: (response: any) => {
      if (response.data.accessToken && response.data.refreshToken) {
        localStorage.setItem('access_token', response.data.accessToken);
        localStorage.setItem('refresh_token', response.data.refreshToken);
      }
      router.push('/');
    },
    onError: () => {},
  });

  const router = useRouter();

  const isEmpty = (value: string) => !value || value.trim() === '';

  const textRules = (message: string, min = 2) => ({
    validate: (value: string) => {
      if (isEmpty(value)) return true;
      if (value.trim().length < min) return message;
      return true;
    },
    required: {
      value: true,
      message,
    },
  });

  const emailRules = (message: string) => ({
    validate: (value: string) => {
      if (isEmpty(value)) return true;
      if (!EMAIL_PATTRERN.test(value)) return message;
      return true;
    },
    required: {
      value: !isKakao,
      message,
    },
  });

  const passwordRules = (message: string) => ({
    validate: (value: string) => {
      if (isEmpty(value)) return true;
      if (!PASSWORD_PATTRERN.test(value)) return message;
      return true;
    },
    required: {
      value: !isKakao,
      message,
    },
  });

  const passwordCheckRules = (message: string) => ({
    validate: (value: string) => {
      if (isEmpty(value)) return true;
      if (!PASSWORD_PATTRERN.test(value)) return message;
      if (value !== getValues('password')) return '비밀번호가 일치하지 않습니다';
      return true;
    },
    required: {
      value: !isKakao,
      message,
    },
  });

  const phoneRules = (message: string) => ({
    validate: (value: string) => {
      if (isEmpty(value)) return true;
      if (!PHONE_PATTRERN.test(value)) return message;
      return true;
    },
    required: {
      value: true,
      message,
    },
  });

  const addressRules = (message: string) => ({
    validate: (value: string) => {
      if (isEmpty(value)) return true;
      return true;
    },
    required: {
      value: isKakao,
      message,
    },
  });

  const handleEmailCheck = () => {
    if (!isKakao) {
      emailCheckMutate({ email: getValues('email') });
    }
  };

  const handlePhoneCheck = () => {
    smsSendMutate({ phone: getValues('phone') });
  };

  const handleCode = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (value.length <= 6) setSmsCode(value);
  };

  const handlePhoneReset = () => {
    setIsCode(false);
    setValue('phone', '');
  };

  const handleSmsVerify = () => {
    smsVerifyMutate({ code: smsCode, phone: getValues('phone') });
  };

  const onSubmit = handleSubmit((data) => {
    if (isKakao) {
      const kakaoSignupData = {
        kakaoId: kakaoData!.kakaoId,
        name: data.name,
        phone: data.phone,
        role: data.role,
        profileImageUrl: kakaoData!.profileImageUrl,
        address: data.address,
        addressDetail: data.addressDetail,
      };
      signupKakaoMutate(kakaoSignupData);
    } else {
      const signupData = {
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        role: data.role,
      };
      signupMutate(signupData);
    }
  });

  const submitDisabled = !isValid || (!isKakao && !isEmailCheck) || !isSmsCheck;

  return (
    <form className={cx('container')} onSubmit={onSubmit}>
      {!isKakao && (
        <TextInput
          label={'이메일'}
          placeholder={'이메일을 입력 해주세요'}
          required
          {...register('email', emailRules('이메일 형식이 올바르지 않습니다.'))}
          onBlur={handleEmailCheck}
          error={
            Boolean(errors.email && allValues.email && allValues.email.trim() !== '') ||
            (!isEmailCheck && !!getValues('email').length)
          }
          errorText={errors.email?.message ?? '이메일이 중복되었습니다.'}
        />
      )}
      {!isKakao && (
        <TextInput
          label={'비밀번호'}
          placeholder={'비밀번호를 입력하세요'}
          required
          {...register('password', passwordRules('비밀번호 형식이 올바르지 않습니다.'))}
          error={Boolean(errors.password && allValues.password && allValues.password.trim() !== '')}
          errorText={errors.password?.message}
        />
      )}
      {!isKakao && (
        <TextInput
          label={'비밀번호 확인'}
          placeholder={'비밀번호를 다시 입력하세요'}
          required
          {...register('passwordCheck', passwordCheckRules('비밀번호가 일치하지 않습니다.'))}
          error={Boolean(errors.passwordCheck && allValues.passwordCheck && allValues.passwordCheck.trim() !== '')}
          errorText={errors.passwordCheck?.message}
        />
      )}
      <TextInput
        label={'이름'}
        placeholder={'이름을 입력하세요'}
        required
        {...register('name', textRules('이름을 입력하세요.', 2))}
        error={Boolean(errors.name && allValues.name && allValues.name.trim() !== '')}
        errorText={errors.name?.message}
      />
      <TextInput
        label={'전화번호'}
        placeholder={'전화번호를 입력하세요'}
        required
        {...register('phone', phoneRules('전화번호 형식이 올바르지 않습니다.'))}
        error={Boolean(errors.phone && allValues.phone && allValues.phone.trim() !== '')}
        disabled={isCode}
        errorText={errors.phone?.message}
      />
      <button type="button" onClick={handlePhoneCheck}>
        인증번호 전송
      </button>
      <button type="button" onClick={handlePhoneReset}>
        재설정
      </button>
      {isCode && (
        <>
          <TextInput
            error={Boolean(isError)}
            errorText="인증번호가 올바르지 않습니다."
            label="인증번호"
            maxLength={6}
            value={smsCode}
            onChange={handleCode}
            placeholder="인증번호를 입력하세요."
          />
          <button type="button" onClick={handleSmsVerify}>
            인증 확인
          </button>
        </>
      )}
      {isKakao && (
        <TextInput
          label={'주소'}
          placeholder={'주소를 입력하세요'}
          required
          {...register('address', addressRules('주소를 입력하세요.'))}
          error={Boolean(errors.address && allValues.address && allValues.address.trim() !== '')}
          errorText={errors.address?.message}
        />
      )}
      {isKakao && (
        <TextInput
          label={'상세 주소'}
          placeholder={'상세 주소를 입력하세요'}
          {...register('addressDetail')}
        />
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
      <button className={cx('button')} disabled={submitDisabled} type="submit">
        회원가입 완료
      </button>
    </form>
  );
}
