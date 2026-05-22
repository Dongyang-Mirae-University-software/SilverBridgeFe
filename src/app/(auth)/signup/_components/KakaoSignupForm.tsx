'use client';

import classNames from 'classnames/bind';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ChangeEvent, useState } from 'react';

import styles from './SignupForm.module.css';
import TextInput from '@/components/TextInput';
import { signupKakao, signupSmsSend, signupSmsVerify } from '@/service/api/auth';
import { PHONE_PATTRERN } from '@/constants/pattern';
import { GenderType, IKakaoSignupRes, RoleType } from '@/service/interface/auth';
import { getRoleHomePath } from '@/lib/auth/routes';
import { completeSigninSession } from '@/lib/auth/completeSignin';

const cx = classNames.bind(styles);

interface KakaoSignupFormProps {
  kakaoData: {
    kakaoId: string;
    email: string;
    name: string;
    profileImageUrl?: string;
  };
}

type FormData = {
  name: string;
  phone: string;
  verificationNonce: string;
  role: RoleType;
  address: string;
  addressDetail: string;
  gender: GenderType;
  birthDate: string;
  postcode: string;
};

type KakaoSignupData = IKakaoSignupRes['data'];

function getKakaoSignupData(response: unknown): KakaoSignupData {
  const data = (response as { data?: unknown }).data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;

  return (nestedData ?? data ?? response) as KakaoSignupData;
}

function getVerificationNonce(response: unknown) {
  const data = (response as { data?: unknown } | undefined)?.data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;
  const result = (nestedData ?? data ?? response) as { verificationNonce?: unknown };

  return typeof result.verificationNonce === 'string' ? result.verificationNonce : '';
}

const requiredRule = (message: string) => ({
  required: { value: true, message },
});

const phoneRule = (message: string) => ({
  validate: (value: string) => {
    if (!value || PHONE_PATTRERN.test(value)) return true;
    return message;
  },
  required: { value: true, message },
});

export default function KakaoSignupForm({ kakaoData }: KakaoSignupFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    getValues,
    setValue,
  } = useForm<FormData>({
    mode: 'all',
    defaultValues: {
      name: kakaoData.name,
      phone: '',
      verificationNonce: '',
      role: 'WARD',
      address: '',
      addressDetail: '',
      gender: 'FEMALE',
      birthDate: '',
      postcode: '',
    },
  });

  const [isCode, setIsCode] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [isSmsCheck, setIsSmsCheck] = useState(false);

  const { mutate: sendSms } = useMutation({
    mutationKey: ['kakao-sms-send'],
    mutationFn: signupSmsSend,
    onMutate: () => {
      setSmsCode('');
      setIsSmsCheck(false);
      setValue('verificationNonce', '');
    },
    onSuccess: () => setIsCode(true),
    onError: () => {},
  });

  const { mutate: verifySms, isError } = useMutation({
    mutationKey: ['kakao-sms-verify'],
    mutationFn: signupSmsVerify,
    onMutate: () => {
      setIsSmsCheck(false);
      setValue('verificationNonce', '');
    },
    onSuccess: response => {
      const verificationNonce = getVerificationNonce(response);
      setValue('verificationNonce', verificationNonce);
      setIsSmsCheck(Boolean(verificationNonce));
    },
    onError: () => {},
  });

  const { mutate: signupKakaoMutate } = useMutation({
    mutationKey: ['kakao-signup'],
    mutationFn: signupKakao,
    onSuccess: response => {
      const data = getKakaoSignupData(response);

      if (data.accessToken && data.refreshToken) {
        completeSigninSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          role: data.role,
        });
      }
      router.push(getRoleHomePath(data.role));
    },
    onError: () => {},
  });

  const handlePhoneCheck = () => sendSms({ phone: getValues('phone') });
  const handleCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, '');
    setSmsCode(value.slice(0, 6));
  };
  const handlePhoneReset = () => {
    setIsCode(false);
    setSmsCode('');
    setIsSmsCheck(false);
    setValue('phone', '');
    setValue('verificationNonce', '');
  };
  const handleSmsVerify = () => {
    if (smsCode.length !== 6) return;
    verifySms({ code: smsCode, phone: getValues('phone') });
  };

  const onSubmit = handleSubmit(data => {
    signupKakaoMutate({
      kakaoId: kakaoData.kakaoId,
      name: data.name,
      phone: data.phone,
      verificationNonce: data.verificationNonce,
      role: data.role,
      profileImageUrl: kakaoData.profileImageUrl,
      address: data.address,
      addressDetail: data.addressDetail,
      gender: data.gender,
      birthDate: data.birthDate,
      postcode: data.postcode,
    });
  });

  return (
    <form className={cx('container')} onSubmit={onSubmit}>
      <TextInput label="이메일" value={kakaoData.email} disabled />
      <TextInput label="이름" value={kakaoData.name} disabled />
      <TextInput
        label="전화번호"
        placeholder="전화번호를 입력하세요"
        {...register('phone', phoneRule('전화번호 형식이 올바르지 않습니다.'))}
        error={Boolean(errors.phone && getValues('phone').trim() !== '')}
        errorText={errors.phone?.message}
        disabled={isCode}
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
            label="인증번호"
            placeholder="인증번호를 입력하세요"
            maxLength={6}
            value={smsCode}
            onChange={handleCodeChange}
            error={Boolean(isError)}
            errorText={isError ? '인증번호가 올바르지 않습니다.' : undefined}
          />
          <button className={cx('secondaryButton')} type="button" onClick={handleSmsVerify}>
            인증 확인
          </button>
        </>
      )}
      <div className={cx('fieldGroup')}>
        <label className={cx('selectField')}>
          <span className={cx('selectLabel')}>성별 *</span>
          <span className={cx('selectBox')}>
            <select {...register('gender')}>
              <option value="FEMALE">여성</option>
              <option value="MALE">남성</option>
            </select>
          </span>
        </label>
        <TextInput
          label="생년월일"
          required
          type="date"
          {...register('birthDate', requiredRule('생년월일을 입력하세요.'))}
          error={Boolean(errors.birthDate)}
          errorText={errors.birthDate?.message}
        />
      </div>
      <TextInput
        label="우편번호"
        placeholder="06236"
        required
        inputMode="numeric"
        maxLength={10}
        {...register('postcode', requiredRule('우편번호를 입력하세요.'))}
        error={Boolean(errors.postcode)}
        errorText={errors.postcode?.message}
      />
      <TextInput label="주소" placeholder="주소를 입력하세요" {...register('address', requiredRule('주소를 입력하세요.'))} error={Boolean(errors.address)} errorText={errors.address?.message} />
      <TextInput
        label="상세 주소"
        placeholder="상세 주소를 입력하세요"
        required
        {...register('addressDetail', requiredRule('상세 주소를 입력하세요.'))}
        error={Boolean(errors.addressDetail)}
        errorText={errors.addressDetail?.message}
      />
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
      <button className={cx('button')} type="submit" disabled={!isValid || !isSmsCheck || !getValues('verificationNonce')}>
        회원가입 완료
      </button>
    </form>
  );
}
