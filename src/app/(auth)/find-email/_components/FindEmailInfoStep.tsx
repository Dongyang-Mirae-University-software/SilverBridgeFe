'use client';

import { FormEvent } from 'react';
import classNames from 'classnames/bind';

import TextInput from '@/app/_components/common/TextInput';
import { IFindEmailReq } from '@/service/interface/auth';
import styles from './FindEmailContent.module.css';

const cx = classNames.bind(styles);

interface Props {
  errorMessage: string;
  form: IFindEmailReq;
  isPending: boolean;
  onChange: (next: IFindEmailReq) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function FindEmailInfoStep({ errorMessage, form, isPending, onChange, onSubmit }: Props) {
  const isValid = form.name.trim().length > 0 && form.phone.trim().length > 0;

  return (
    <form className={cx('form')} onSubmit={onSubmit}>
      <TextInput
        label="이름"
        name="name"
        placeholder="이름을 입력하세요"
        value={form.name}
        onChange={event => onChange({ ...form, name: event.target.value })}
      />
      <TextInput
        autoComplete="tel"
        label="휴대폰 번호"
        name="phone"
        placeholder="숫자만 입력하세요"
        type="tel"
        value={form.phone}
        onChange={event => onChange({ ...form, phone: event.target.value })}
      />
      {errorMessage && <p className={cx('errorMessage')}>{errorMessage}</p>}
      <button className={cx('submitButton')} disabled={!isValid || isPending} type="submit">
        인증번호 받기
      </button>
    </form>
  );
}
