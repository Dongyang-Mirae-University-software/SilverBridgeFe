'use client';

import { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import useFindEmailFlow from '../_hooks/useFindEmailFlow';
import FindEmailInfoStep from './FindEmailInfoStep';
import FindEmailResultStep from './FindEmailResultStep';
import styles from './FindEmailContent.module.css';

const cx = classNames.bind(styles);

interface Props {
  onClose?: () => void;
}

export default function FindEmailContent({ onClose }: Props) {
  const flow = useFindEmailFlow();
  const router = useRouter();

  const handleInfoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await flow.requestEmail(flow.form);
    } catch {
      // useFindEmailFlow가 오류 문구를 화면에 표시한다.
    }
  };

  return (
    <>
      <div className={cx('header')}>
        <h1 className={cx('title')}>아이디 찾기</h1>
        <button className={cx('closeButton')} type="button" onClick={onClose ?? (() => router.push('/login'))}>
          ✕
        </button>
      </div>

      {flow.step === 1 && (
        <FindEmailInfoStep
          errorMessage={flow.errorMessage}
          form={flow.form}
          isPending={flow.isRequesting}
          onChange={flow.setForm}
          onSubmit={handleInfoSubmit}
        />
      )}
      {flow.step === 2 && flow.result && <FindEmailResultStep result={flow.result} />}
    </>
  );
}
