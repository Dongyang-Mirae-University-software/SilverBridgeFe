'use client';

import { useForm } from 'react-hook-form';

import { ISignupReq } from '@/service/interface/contactus';

type FormData = {
  name: string;
  email: string;
  password: string;
  passwordCheck: string;
  phoneNumber: string;
};

export default function useContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    mode: 'all',
    defaultValues: {
      name: '',
      email: '', // 초기값은 빈 문자열
      password: '',
      passwordCheck: '',
      phoneNumber: '',
    },
  });

  // 모든 필드의 현재 값을 watch
  const allValues = watch();

  // validation 함수들 - 값이 있을 때만 에러 표시
  const createValidationRules = (errorMessage: string, hasMinLength = false) => ({
    validate: (value: string) => {
      // 값이 완전히 비어있으면 에러 표시 안함
      if (!value || value.trim() === '') {
        return true;
      }
      // 값이 있는데 길이가 부족하면 에러
      if (hasMinLength && value.trim().length < 2) {
        return errorMessage;
      }
      return true;
    },
    required: {
      value: true,
      message: errorMessage,
    },
  });

  const createEmailValidationRules = (errorMessage: string) => ({
    validate: (value: string) => {
      // 값이 완전히 비어있으면 에러 표시 안함
      if (!value || value.trim() === '') {
        return true;
      }
      // 값이 있는데 이메일 형식이 아니면 에러
      const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
      if (!emailPattern.test(value)) {
        return errorMessage;
      }
      return true;
    },
    required: {
      value: true,
      message: errorMessage,
    },
  });

  const createPasswordValidationRules = (errorMessage: string) => ({
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return true;
      }
      if (value.length < 8) {
        return errorMessage;
      }
      return true;
    },
    required: {
      value: true,
      message: errorMessage,
    },
  });

  function formDataInit() {
    reset({
      name: '',
      email: '',
      password: '',
      passwordCheck: '',
      phoneNumber: '',
    });
  }

  function onSubmit(formData: ISignupReq) {
    const form: ISignupReq = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phoneNumber: formData.phoneNumber,
    };
  }

  return {
    register,
    formState: { errors, isValid },
    onSubmit: handleSubmit(onSubmit),
    watch,
    setValue,
    createValidationRules,
    createEmailValidationRules,
    allValues,
  };
}
