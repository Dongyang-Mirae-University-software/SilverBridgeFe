'use client';

import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import { IFindEmailResponse } from '@/service/interface/auth';
import styles from './FindEmailContent.module.css';

const cx = classNames.bind(styles);

interface Props {
  result: IFindEmailResponse;
}

export default function FindEmailResultStep({ result }: Props) {
  const router = useRouter();

  return (
    <div className={cx('section')}>
      <div className={cx('resultBox')}>
        {result.maskedEmail && <p className={cx('resultText')}>가입된 이메일: {result.maskedEmail}</p>}
        {result.hasKakaoAccount && <p className={cx('resultText')}>카카오 계정이 존재합니다.</p>}
      </div>
      <div className={cx('resultActions')}>
        <button className={cx('submitButton')} type="button" onClick={() => router.push('/login')}>
          로그인하러 가기
        </button>
        <button className={cx('secondaryButton')} type="button" onClick={() => router.push('/find-password')}>
          비밀번호 찾기
        </button>
      </div>
    </div>
  );
}
