'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { findEmail } from '@/service/api/auth/auth';
import { IFindEmailReq, IFindEmailResponse } from '@/service/interface/auth';

function isFindEmailResponse(value: unknown): value is IFindEmailResponse {
  return typeof value === 'object' && value !== null && ('maskedEmail' in value || 'hasKakaoAccount' in value);
}

function getFindEmailResult(response: unknown) {
  if (isFindEmailResponse(response)) return response;

  const data = (response as { data?: unknown }).data;
  if (isFindEmailResponse(data)) return data;

  const nestedData = (data as { data?: unknown } | undefined)?.data;
  if (isFindEmailResponse(nestedData)) return nestedData;

  return { maskedEmail: null, hasKakaoAccount: false };
}

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
      setResult(getFindEmailResult(response));
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
    requestEmail: (payload: IFindEmailReq) => requestMutation.mutateAsync(payload),
  };
}
