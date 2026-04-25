'use client';

import classNames from 'classnames/bind';

import { IFindEmailResponse } from '@/service/interface/auth';
import styles from './FindEmailContent.module.css';

const cx = classNames.bind(styles);

interface Props {
  result: IFindEmailResponse;
}

export default function FindEmailResultDisplay({ result }: Props) {
  return (
    <div className={cx('resultBox')}>
      {result.maskedEmail && <p className={cx('resultText')}>가입된 이메일: {result.maskedEmail}</p>}
      {result.hasKakaoAccount && <p className={cx('resultText')}>카카오 계정이 존재합니다.</p>}
    </div>
  );
}