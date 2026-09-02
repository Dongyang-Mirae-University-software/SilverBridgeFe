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
} from '@/service/api/auth/auth';
import { CommonResponse } from '@/service/interface/common';
import {
  IFindPasswordEmailSendReq,
  IFindPasswordSmsSendReq,
  IFindPasswordSendResponse,
  IPasswordResetReq,
} from '@/service/interface/auth';

type Method = 'email' | 'sms';
const DEFAULT_VERIFICATION_EXPIRES_SECONDS = 300;
const DEFAULT_VERIFICATION_CODE_LENGTH = 6;

function isCommonResponse<T>(value: unknown): value is CommonResponse<T> {
  return typeof value === 'object' && value !== null && ('code' in value || 'success' in value);
}

function getCommonResponse<T>(response: unknown) {
  if (isCommonResponse<T>(response)) return response;

  const data = (response as { data?: unknown }).data;
  if (isCommonResponse<T>(data)) return data;

  return null;
}

function isVerifySuccess(response: unknown) {
  const result = getCommonResponse<null>(response);

  return result?.success === true || result?.code === 200;
}

function getSendResult(response: unknown) {
  const result = getCommonResponse<IFindPasswordSendResponse>(response);

  return {
    expiresInSeconds: result?.data?.expiresInSeconds ?? DEFAULT_VERIFICATION_EXPIRES_SECONDS,
    codeLength: result?.data?.codeLength ?? DEFAULT_VERIFICATION_CODE_LENGTH,
  };
}

export default function useFindPasswordFlow() {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<Method | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [verifiedCode, setVerifiedCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [verificationConfig, setVerificationConfig] = useState({
    expiresInSeconds: DEFAULT_VERIFICATION_EXPIRES_SECONDS,
    codeLength: DEFAULT_VERIFICATION_CODE_LENGTH,
  });

  const sendEmailMutation = useMutation({
    mutationFn: findPasswordEmailSend,
    onSuccess: response => {
      setVerificationConfig(getSendResult(response));
      setErrorMessage('');
    },
    onError: (error: Error) => setErrorMessage(error.message || '이메일 발송에 실패했습니다.'),
  });

  const verifyEmailMutation = useMutation({
    mutationFn: findPasswordEmailVerify,
    onError: (error: Error) => setErrorMessage(error.message || '토큰 검증에 실패했습니다.'),
  });

  const resendEmailMutation = useMutation({
    mutationFn: findPasswordEmailResend,
    onSuccess: response => {
      setVerificationConfig(getSendResult(response));
      setErrorMessage('');
    },
    onError: (error: Error) => setErrorMessage(error.message || '이메일 재발송에 실패했습니다.'),
  });

  const sendSmsMutation = useMutation({
    mutationFn: findPasswordSmsSend,
    onSuccess: response => {
      setVerificationConfig(getSendResult(response));
      setErrorMessage('');
    },
    onError: (error: Error) => setErrorMessage(error.message || 'SMS 발송에 실패했습니다.'),
  });

  const verifySmsMutation = useMutation({
    mutationFn: findPasswordSmsVerify,
    onError: (error: Error) => setErrorMessage(error.message || '인증코드 확인에 실패했습니다.'),
  });

  const resendSmsMutation = useMutation({
    mutationFn: findPasswordSmsResend,
    onSuccess: response => {
      setVerificationConfig(getSendResult(response));
      setErrorMessage('');
    },
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
    verifiedCode,
    errorMessage,
    verificationConfig,
    isSending: sendEmailMutation.isPending || sendSmsMutation.isPending,
    isVerifying: verifyEmailMutation.isPending || verifySmsMutation.isPending,
    isResetting: resetPasswordMutation.isPending,
    setStep,
    setMethod,
    setEmail,
    setName,
    setPhone,
    setErrorMessage,
    sendEmail: (body: IFindPasswordEmailSendReq) => sendEmailMutation.mutateAsync(body),
    verifyCode: async (body: { email: string; code: string } | { phone: string; code: string }) => {
      try {
        const response = 'email' in body
          ? await verifyEmailMutation.mutateAsync(body)
          : await verifySmsMutation.mutateAsync(body);

        if (!isVerifySuccess(response)) {
          setVerifiedCode('');
          setErrorMessage('인증번호가 올바르지 않습니다.');
          return false;
        }

        setErrorMessage('');
        setVerifiedCode(body.code);
        return true;
      } catch {
        setVerifiedCode('');
        return false;
      }
    },
    resendEmail: (body: IFindPasswordEmailSendReq) => resendEmailMutation.mutateAsync(body),
    sendSms: (body: IFindPasswordSmsSendReq) => sendSmsMutation.mutateAsync(body),
    resendSms: (body: IFindPasswordSmsSendReq) => resendSmsMutation.mutateAsync(body),
    resetPassword: (body: IPasswordResetReq) => resetPasswordMutation.mutateAsync(body),
  };
}
