'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { GenderType, IKakaoSignupReq, ISignupReq, RoleType } from '@/service/interface/auth/auth';
import { EMAIL_PATTRERN, PASSWORD_PATTRERN, PHONE_PATTRERN } from '@/constants/pattern';
import { useMutation } from '@tanstack/react-query';
import { signup, signupKakao } from '@/service/api/auth/auth';
import { useRouter } from 'next/navigation';
import { clearKakaoSignupHandoff } from '@/lib/auth/kakaoSignupHandoff';
import { completeSigninSession } from '@/lib/auth/completeSignin';
import { getRoleHomePath } from '@/utils/auth/routes';
import { getPhoneDigits } from '@/utils/format/phone';
import { getBirthDateError } from '@/utils/format/birthDate';

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
  // 카카오 로그인 응답(신규 회원)에서 받은 일회용 값 - 가입 완료 요청에 그대로 싣는다
  pendingToken: string;
};

type UseSignupFormOptions = {
  kakaoData?: KakaoSignupData;
  returnTo?: string;
};

function getKakaoSignupResponseData(response: unknown) {
  const data = (response as { data?: unknown }).data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;

  return nestedData ?? data ?? response;
}

export default function useSignupForm({ kakaoData, returnTo }: UseSignupFormOptions = {}) {
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

  // 생년월일은 select 세 칸으로 고르고 setValue 로 넣는다 - 검사 규칙을 여기서 건다(QA AUTH-A05)
  register('birthDate', { validate: value => getBirthDateError(value) ?? true });

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

  // 비밀번호를 고치면 확인란도 다시 검사한다 - 확인란만 맞춰 둔 뒤 비밀번호를 바꿔도 다음 버튼이 열렸다(QA AUTH-A03)
  const passwordRules = (message: string) => ({
    ...rules(value => (!PASSWORD_PATTRERN.test(value) ? message : true), message),
    deps: ['passwordCheck' as const],
  });

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
  // 이메일 가입은 토큰을 받지 않아 로그인 화면으로 보낸다 - 말없이 넘기지 않고 완료 안내를 먼저 띄운다
  const [isSignupCompleted, setIsSignupCompleted] = useState(false);

  const { mutate, isPending: isEmailSignupPending } = useMutation({
    mutationKey: ['signup'],
    mutationFn: signup,
  });
  const { mutate: mutateKakao, isPending: isKakaoSignupPending } = useMutation({
    mutationKey: ['kakao-signup'],
    mutationFn: signupKakao,
  });
  // 가입 완료를 빠르게 두 번 눌러도 요청은 한 번만 - isPending은 다음 그리기 전까지 바뀌지 않아 ref로도 막는다(QA AUTH-A10)
  const submittingRef = useRef(false);
  const isSignupPending = isEmailSignupPending || isKakaoSignupPending;

  const router = useRouter();

  function onSubmit(formData: SignupFormValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const release = () => {
      submittingRef.current = false;
    };
    const phone = getPhoneDigits(formData.phone);
    const birthDate = normalizeBirthDateForApi(formData.birthDate);
    const gender = formData.gender as GenderType;

    if (isKakaoSignup && kakaoData) {
      const form: IKakaoSignupReq = {
        kakaoId: kakaoData.kakaoId,
        pendingToken: kakaoData.pendingToken,
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
            role?: RoleType;
          };
          const role = data.role ?? formData.role;

          clearKakaoSignupHandoff();
          if (data.accessToken) {
            completeSigninSession({
              accessToken: data.accessToken,
              role,
            });
          }

          router.push(returnTo ?? getRoleHomePath(role));
        },
        onError: error => {
          setSignupError((error as Error).message || '카카오 회원가입에 실패했습니다. 다시 시도해 주세요.');
        },
        onSettled: release,
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
        setIsSignupCompleted(true);
      },
      onError: error => {
        setSignupError((error as Error).message || '회원가입에 실패했습니다. 다시 시도해 주세요.');
      },
      onSettled: release,
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
    isSignupPending,
    isKakaoSignup,
    clearSignupError: () => setSignupError(null),
    isSignupCompleted,
    goToLogin: () => router.push(returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'),
  };
}

function normalizeBirthDateForApi(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return value.trim();
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}
