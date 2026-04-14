'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import TextInput from '@/app/_components/common/TextInput';
import { findEmail } from '@/service/api/auth';
import styles from './FindEmailContent.module.css';

const cx = classNames.bind(styles);

function extractEmailResult(data: { email?: string } | string | null, message: string) {
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object' && 'email' in data && typeof data.email === 'string') {
    return data.email;
  }
  return message;
}

export default function FindEmailContent() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  const isValid = useMemo(() => name.trim().length > 0 && phone.trim().length > 0, [name, phone]);

  const { mutate, isPending } = useMutation({
    mutationKey: ['find-email'],
    mutationFn: findEmail,
    onMutate: () => {
      setErrorMessage('');
      setResultMessage('');
    },
    onSuccess: response => {
      setResultMessage(extractEmailResult(response.data, response.message));
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || '이메일 찾기에 실패했습니다.');
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isPending) return;

    mutate({
      name: name.trim(),
      phone: phone.trim(),
    });
  };

  return (
    <section className={cx('container')}>
      <div className={cx('panel')}>
        <div className={cx('header')}>
          <p className={cx('eyebrow')}>Silver Bridge</p>
          <h1 className={cx('title')}>이메일 찾기</h1>
          <p className={cx('description')}>이름과 전화번호를 입력하면 가입한 이메일을 확인할 수 있습니다.</p>
        </div>

        <form className={cx('form')} onSubmit={handleSubmit}>
          <TextInput
            label="이름"
            name="name"
            placeholder="이름을 입력하세요"
            value={name}
            onChange={event => setName(event.target.value)}
          />
          <TextInput
            autoComplete="tel"
            label="전화번호"
            name="phone"
            placeholder="전화번호를 입력하세요"
            type="tel"
            value={phone}
            onChange={event => setPhone(event.target.value)}
          />

          {errorMessage && <p className={cx('errorMessage')}>{errorMessage}</p>}
          {resultMessage && <div className={cx('resultBox')}>{resultMessage}</div>}

          <button className={cx('submitButton')} disabled={!isValid || isPending} type="submit">
            {isPending ? '확인 중...' : '이메일 찾기'}
          </button>
        </form>

        <div className={cx('footer')}>
          <button className={cx('linkButton')} type="button" onClick={() => router.push('/login')}>
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    </section>
  );
}
