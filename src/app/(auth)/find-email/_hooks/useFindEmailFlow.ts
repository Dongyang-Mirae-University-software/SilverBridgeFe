'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { findEmail, findEmailVerify } from '@/service/api/auth';
import { IFindEmailReq, IFindEmailResponse } from '@/service/interface/auth';

export default function useFindEmailFlow() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<IFindEmailReq>({ name: '', phone: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<IFindEmailResponse | null>(null);

  const requestMutation = useMutation({
    mutationKey: ['find-email'],
    mutationFn: findEmail,
    onSuccess: () => {
      setErrorMessage('');
      setResult(null);
      setStep(2);
    },
    onError: (error: Error) => setErrorMessage(error.message || '인증번호 요청에 실패했습니다.'),
  });

  const verifyMutation = useMutation({
    mutationKey: ['find-email-verify'],
    mutationFn: findEmailVerify,
    onSuccess: response => {
      setErrorMessage('');
      setResult(response.data);
      setStep(3);
    },
    onError: (error: Error) => setErrorMessage(error.message || '인증번호를 확인해주세요.'),
  });

  return {
    step,
    form,
    result,
    errorMessage,
    isRequesting: requestMutation.isPending,
    isVerifying: verifyMutation.isPending,
    setForm,
    setStep,
    setErrorMessage,
    requestCode: (payload: IFindEmailReq) => requestMutation.mutateAsync(payload),
    verifyCode: (code: string) => verifyMutation.mutateAsync({ ...form, code }),
  };
}
