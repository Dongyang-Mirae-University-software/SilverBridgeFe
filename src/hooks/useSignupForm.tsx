'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { GenderType, IKakaoSignupReq, ISignupReq, RoleType } from '@/service/interface/auth/auth';
import { EMAIL_PATTRERN, PASSWORD_PATTRERN, PHONE_PATTRERN } from '@/constants/pattern';
import { useMutation } from '@tanstack/react-query';
import { signup, signupKakao } from '@/service/api/auth/auth';
import { useRouter } from 'next/navigation';
import { completeSigninSession } from '@/lib/auth/completeSignin';
import { getRoleHomePath } from '@/lib/auth/routes';
import { getPhoneDigits } from '@/lib/format/phone';

export type SignupFormValues = {
  name: string;
  email: string;
  password: string;
  passwordCheck: string;
  phone: string;
  verificationNonce: string;
  role: RoleType;
  address: string;
  addressDetail: string;
  gender: GenderType | '';
  birthDate: string;
  postcode: string;
};

export type KakaoSignupData = {
  kakaoId: string;
  email: string;
  profileImageUrl?: string;
};

type UseSignupFormOptions = {
  kakaoData?: KakaoSignupData;
};

function getKakaoSignupResponseData(response: unknown) {
  const data = (response as { data?: unknown }).data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;

  return nestedData ?? data ?? response;
}

export default function useSignupForm({ kakaoData }: UseSignupFormOptions = {}) {
  const isKakaoSignup = Boolean(kakaoData);
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
    reset,
    getValues,
  } = useForm<SignupFormValues>({
    mode: 'all',
    defaultValues: {
      name: '',
      email: kakaoData?.email || '',
      password: '',
      passwordCheck: '',
      phone: '',
      verificationNonce: '',
      role: 'WARD',
      address: '',
      addressDetail: '',
      gender: '',
      birthDate: '',
      postcode: '',
    },
  });

  // 모든 필드의 현재 값을 watch
  const allValues = watch();

  const isEmpty = (value: string) => !value || value.trim() === '';

  const rules = (validateFn: (value: string) => true | string, errorMessage: string) => ({
    validate: (value: string) => {
      if (isEmpty(value)) return true;
      return validateFn(value);
    },
    required: {
      value: true,
      message: errorMessage,
    },
  });

  const textRules = (message: string, min = 2) =>
    rules(value => {
      if (value.trim().length < min) return message;
      return true;
    }, message);

  const emailRules = (message: string) => rules(value => (!EMAIL_PATTRERN.test(value) ? message : true), message);

  const passwordRules = (message: string) => rules(value => (!PASSWORD_PATTRERN.test(value) ? message : true), message);

  const passwordCheckRules = (message: string) =>
    rules(value => {
      if (!PASSWORD_PATTRERN.test(value)) return message;
      if (value !== getValues('password')) return '비밀번호가 일치하지 않습니다';
      return true;
    }, message);

  const phoneRules = (message: string) => rules(value => (!PHONE_PATTRERN.test(value) ? message : true), message);

  function formDataInit() {
    reset({
      name: '',
      email: '',
      password: '',
      passwordCheck: '',
      phone: '',
      verificationNonce: '',
      role: 'WARD',
      address: '',
      addressDetail: '',
      gender: '',
      birthDate: '',
      postcode: '',
    });
  }

  const [signupError, setSignupError] = useState<string | null>(null);

  const { mutate } = useMutation({
    mutationKey: ['signup'],
    mutationFn: signup,
  });
  const { mutate: mutateKakao } = useMutation({
    mutationKey: ['kakao-signup'],
    mutationFn: signupKakao,
  });

  const router = useRouter();

  function onSubmit(formData: SignupFormValues) {
    const phone = getPhoneDigits(formData.phone);
    const birthDate = normalizeBirthDateForApi(formData.birthDate);
    const gender = formData.gender as GenderType;

    if (isKakaoSignup && kakaoData) {
      const form: IKakaoSignupReq = {
        kakaoId: kakaoData.kakaoId,
        name: formData.name,
        phone,
        verificationNonce: formData.verificationNonce,
        role: formData.role,
        profileImageUrl: kakaoData.profileImageUrl,
        address: formData.address,
        addressDetail: formData.addressDetail,
        gender,
        birthDate,
        postcode: formData.postcode,
      };

      mutateKakao(form, {
        onSuccess: response => {
          const data = getKakaoSignupResponseData(response) as {
            accessToken?: string;
            refreshToken?: string;
            role?: RoleType;
          };
          const role = data.role ?? formData.role;

          if (data.accessToken && data.refreshToken) {
            completeSigninSession({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              role,
            });
          }

          router.push(getRoleHomePath(role));
        },
        onError: error => {
          setSignupError((error as Error).message || '카카오 회원가입에 실패했습니다. 다시 시도해 주세요.');
        },
      });
      return;
    }

    const form: ISignupReq = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone,
      verificationNonce: formData.verificationNonce,
      role: formData.role,
      address: formData.address,
      addressDetail: formData.addressDetail,
      gender,
      birthDate,
      postcode: formData.postcode,
    };

    mutate(form, {
      onSuccess: () => {
        formDataInit();
        router.push('/login');
      },
      onError: error => {
        setSignupError((error as Error).message || '회원가입에 실패했습니다. 다시 시도해 주세요.');
      },
    });
  }

  return {
    register,
    formState: { errors, isValid },
    onSubmit: handleSubmit(onSubmit),
    watch,
    getValues,
    setValue,
    textRules,
    emailRules,
    passwordCheckRules,
    passwordRules,
    phoneRules,
    allValues,
    signupError,
    isKakaoSignup,
    clearSignupError: () => setSignupError(null),
  };
}

function normalizeBirthDateForApi(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return value.trim();
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}
