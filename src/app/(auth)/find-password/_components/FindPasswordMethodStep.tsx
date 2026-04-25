'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import styles from './FindPasswordContent.module.css';

const cx = classNames.bind(styles);

type Method = 'email' | 'sms';

interface Props {
  onSelectMethod: (method: Method) => void;
}

export default function FindPasswordMethodStep({ onSelectMethod }: Props) {
  return (
    <div className={cx('section')}>
      <h2 className={cx('stepTitle')}>비밀번호 찾기 방식 선택</h2>
      <p className={cx('description')}>비밀번호를 찾을 방법을 선택하세요.</p>
      <div className={cx('methodButtons')}>
        <button className={cx('methodButton')} onClick={() => onSelectMethod('email')}>
          이메일로 찾기
        </button>
        <button className={cx('methodButton')} onClick={() => onSelectMethod('sms')}>
          SMS로 찾기
        </button>
      </div>
    </div>
  );
}