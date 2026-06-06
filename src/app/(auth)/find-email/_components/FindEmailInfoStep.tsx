'use client';

import { FormEvent } from 'react';

import { IFindEmailReq } from '@/service/interface/auth';
import { formatPhoneNumber, getPhoneDigits } from '@/lib/format/phone';
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
      <p className={cx('description')}>
        이름과 전화번호를 입력하시면
        <br />
        가입한 이메일을 마스킹 처리해 알려드려요.
      </p>
      <div className={cx('fieldGroup')}>
        <div className={cx('field')}>
          <label className={cx('label')} htmlFor="find-email-name">
            이름
          </label>
          <input
            className={cx('input')}
            id="find-email-name"
            name="name"
            placeholder="홍길동"
            value={form.name}
            onChange={event => onChange({ ...form, name: event.target.value })}
          />
        </div>
        <div className={cx('field')}>
          <label className={cx('label')} htmlFor="find-email-phone">
            전화번호
          </label>
          <input
            autoComplete="tel"
            className={cx('input')}
            id="find-email-phone"
            name="phone"
            placeholder="010-0000-0000"
            type="tel"
            value={formatPhoneNumber(form.phone)}
            onChange={event => onChange({ ...form, phone: getPhoneDigits(event.target.value) })}
          />
        </div>
      </div>
      {errorMessage && <p className={cx('errorMessage')}>{errorMessage}</p>}
      <button className={cx('submitButton')} disabled={!isValid || isPending} type="submit">
        {isPending ? '찾는 중...' : '아이디 찾기'}
      </button>
    </form>
  );
}
