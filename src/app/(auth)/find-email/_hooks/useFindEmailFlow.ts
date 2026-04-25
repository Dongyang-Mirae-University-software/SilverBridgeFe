'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { findEmail } from '@/service/api/auth';
import { IFindEmailReq, IFindEmailResponse } from '@/service/interface/auth';

export default function useFindEmailFlow() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<IFindEmailReq>({ name: '', phone: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<IFindEmailResponse>();

  const requestMutation = useMutation({
    mutationKey: ['find-email'],
    mutationFn: findEmail,
    onSuccess: response => {
      setErrorMessage('');
      setResult(response.data.data);
      setStep(2);
    },
    onError: (error: Error) => setErrorMessage(error.message || '이메일 찾기에 실패했습니다.'),
  });

  return {
    step,
    form,
    result,
    errorMessage,
    isRequesting: requestMutation.isPending,
    setForm,
    setStep,
    setErrorMessage,
    requestCode: (payload: IFindEmailReq) => requestMutation.mutateAsync(payload),
  };
}
