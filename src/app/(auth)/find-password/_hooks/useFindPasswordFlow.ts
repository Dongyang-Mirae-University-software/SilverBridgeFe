'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import {
  findPasswordEmailSend,
  findPasswordEmailVerify,
  findPasswordEmailResend,
  findPasswordSmsSend,
  findPasswordSmsVerify,
  findPasswordSmsResend,
  passwordReset,
} from '@/service/api/auth';
import { CommonResponse } from '@/service/interface/common';
import {
  IFindPasswordEmailSendReq,
  IFindPasswordSmsSendReq,
  IFindPasswordTokenResponse,
  IPasswordResetReq,
} from '@/service/interface/auth';

type Method = 'email' | 'sms';

function isCommonResponse<T>(value: unknown): value is CommonResponse<T> {
  return typeof value === 'object' && value !== null && 'data' in value && ('code' in value || 'success' in value);
}

function getCommonResponse<T>(response: unknown) {
  if (isCommonResponse<T>(response)) return response;

  const data = (response as { data?: unknown }).data;
  if (isCommonResponse<T>(data)) return data;

  return null;
}

function getVerifiedToken(response: unknown) {
  const result = getCommonResponse<IFindPasswordTokenResponse>(response);
  const token = result?.data?.token;

  if ((result?.success === true || result?.code === 200) && typeof token === 'string' && token.length > 0) {
    return token;
  }

  return null;
}

export default function useFindPasswordFlow() {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<Method | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const sendEmailMutation = useMutation({
    mutationFn: findPasswordEmailSend,
    onSuccess: () => setErrorMessage(''),
    onError: (error: Error) => setErrorMessage(error.message || '이메일 발송에 실패했습니다.'),
  });

  const verifyEmailMutation = useMutation({
    mutationFn: findPasswordEmailVerify,
    onError: (error: Error) => setErrorMessage(error.message || '토큰 검증에 실패했습니다.'),
  });

  const resendEmailMutation = useMutation({
    mutationFn: findPasswordEmailResend,
    onSuccess: () => setErrorMessage(''),
    onError: (error: Error) => setErrorMessage(error.message || '이메일 재발송에 실패했습니다.'),
  });

  const sendSmsMutation = useMutation({
    mutationFn: findPasswordSmsSend,
    onSuccess: () => setErrorMessage(''),
    onError: (error: Error) => setErrorMessage(error.message || 'SMS 발송에 실패했습니다.'),
  });

  const verifySmsMutation = useMutation({
    mutationFn: findPasswordSmsVerify,
    onError: (error: Error) => setErrorMessage(error.message || '인증코드 확인에 실패했습니다.'),
  });

  const resendSmsMutation = useMutation({
    mutationFn: findPasswordSmsResend,
    onSuccess: () => setErrorMessage(''),
    onError: (error: Error) => setErrorMessage(error.message || 'SMS 재발송에 실패했습니다.'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: passwordReset,
    onSuccess: () => setErrorMessage(''),
    onError: (error: Error) => setErrorMessage(error.message || '비밀번호 변경에 실패했습니다.'),
  });

  return {
    step,
    method,
    email,
    name,
    phone,
    token,
    errorMessage,
    isSending: sendEmailMutation.isPending || sendSmsMutation.isPending,
    isVerifying: verifyEmailMutation.isPending || verifySmsMutation.isPending,
    isResetting: resetPasswordMutation.isPending,
    setStep,
    setMethod,
    setEmail,
    setFormField: (field: 'name' | 'phone', value: string) => {
      if (field === 'name') setName(value);
      else setPhone(value);
    },
    setErrorMessage,
    sendEmail: (body: IFindPasswordEmailSendReq) => sendEmailMutation.mutateAsync(body),
    verifyCode: async (body: { token: string } | { phone: string; code: string }) => {
      const response = 'token' in body
        ? await verifyEmailMutation.mutateAsync(body)
        : await verifySmsMutation.mutateAsync(body);
      const verifiedToken = getVerifiedToken(response);

      if (!verifiedToken) {
        setToken(null);
        setErrorMessage('인증번호가 올바르지 않습니다.');
        return false;
      }

      setErrorMessage('');
      setToken(verifiedToken);
      return true;
    },
    resendEmail: (body: IFindPasswordEmailSendReq) => resendEmailMutation.mutateAsync(body),
    sendSms: (body: IFindPasswordSmsSendReq) => sendSmsMutation.mutateAsync(body),
    resendSms: (body: IFindPasswordSmsSendReq) => resendSmsMutation.mutateAsync(body),
    resetPassword: (body: IPasswordResetReq) => resetPasswordMutation.mutateAsync(body),
  };
}
