'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { ISignupReq, RoleType } from '@/service/interface/auth';
import { EMAIL_PATTRERN, PASSWORD_PATTRERN, PHONE_PATTRERN } from '../constant/pattern';
import { useMutation } from '@tanstack/react-query';
import { signup } from '@/service/api/auth';
import { useRouter } from 'next/navigation';

export type SignupFormValues = {
  name: string;
  email: string;
  password: string;
  passwordCheck: string;
  phone: string;
  role: RoleType;
  address: string;
  addressDetail: string;
};

export default function useSignupForm() {
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
      email: '', // 초기값은 빈 문자열
      password: '',
      passwordCheck: '',
      phone: '',
      role: 'WARD',
      address: '',
      addressDetail: '',
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
      address: '',
      addressDetail: '',
    });
  }

  const [signupError, setSignupError] = useState<string | null>(null);

  const { mutate } = useMutation({
    mutationKey: ['signup'],
    mutationFn: signup,
  });

  const router = useRouter();

  function onSubmit(formData: SignupFormValues) {
    const form: ISignupReq = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      role: formData.role,
      address: formData.address,
      addressDetail: formData.addressDetail,
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
    clearSignupError: () => setSignupError(null),
  };
}
