'use client';

import { useForm } from 'react-hook-form';

import { ISignupReq, RoleType } from '@/service/interface/auth';
import { EMAIL_PATTRERN, PASSWORD_PATTRERN, PHONE_PATTRERN } from '../constant/pattern';
import { useMutation } from '@tanstack/react-query';
import { signup } from '@/service/api/auth';

type FormData = {
  name: string;
  email: string;
  password: string;
  passwordCheck: string;
  phone: string;
  role: RoleType;
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
  } = useForm<FormData>({
    mode: 'all',
    defaultValues: {
      name: '',
      email: '', // 초기값은 빈 문자열
      password: '',
      passwordCheck: '',
      phone: '',
      role: 'WARD',
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
    });
  }

  const { mutate } = useMutation({
    mutationKey: ['signup'],
    mutationFn: signup,
  });

  function onSubmit(formData: ISignupReq) {
    const form: ISignupReq = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      role: formData.role,
    };

    mutate(form, {
      onSuccess: () => {
        formDataInit();
      },
      onError: () => {},
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
  };
}
