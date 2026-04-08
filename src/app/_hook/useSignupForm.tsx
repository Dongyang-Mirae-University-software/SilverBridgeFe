'use client';

import { useForm } from 'react-hook-form';

import { ISignupReq } from '@/service/interface/contactus';

const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const passwordPattern = /^(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])\S{8,}$/;
const phonePattern = /^010\d{8}$/;

type FormData = {
  name: string;
  email: string;
  password: string;
  passwordCheck: string;
  phone: string;
};

export default function useContactForm() {
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

  const emailRules = (message: string) => rules(value => (!emailPattern.test(value) ? message : true), message);

  const passwordRules = (message: string) => rules(value => (!passwordPattern.test(value) ? message : true), message);

  const passwordCheckRules = (message: string) =>
    rules(value => {
      if (!passwordPattern.test(value)) return message;
      if (value !== getValues('password')) return '비밀번호가 일치하지 않습니다';
      return true;
    }, message);

  const phoneRules = (message: string) => rules(value => (!phonePattern.test(value) ? message : true), message);

  function formDataInit() {
    reset({
      name: '',
      email: '',
      password: '',
      passwordCheck: '',
      phone: '',
    });
  }

  function onSubmit(formData: ISignupReq) {
    const form: ISignupReq = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
    };
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
