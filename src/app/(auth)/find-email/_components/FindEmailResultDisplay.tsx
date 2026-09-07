'use client';

import classNames from 'classnames/bind';

import { IFindEmailResponse } from '@/service/interface/auth/auth';
import styles from './FindEmailResultDisplay.module.css';

const cx = classNames.bind(styles);

interface Props {
  result: IFindEmailResponse;
}

export default function FindEmailResultDisplay({ result }: Props) {
  const email = result.maskedEmail ?? (result.hasKakaoAccount ? '카카오 계정' : '가입 정보 없음');

  return (
    <div className={cx('resultBox')}>
      <div className={cx('resultLabel')}>회원님의 아이디</div>
      <div className={cx('resultEmail')}>{email}</div>
      {result.createdAt && <div className={cx('resultDate')}>가입일 {result.createdAt}</div>}
    </div>
  );
}
