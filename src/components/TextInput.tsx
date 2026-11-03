import React, { ForwardedRef, InputHTMLAttributes, useId } from 'react';
import classNames from 'classnames/bind';

import styles from './TextInput.module.css';

const cx = classNames.bind(styles);

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  errorText?: string;
  required?: boolean;
  label?: string;
  variant?: 'default' | 'auth';
}

function TextInput(
  { id, label, required = false, errorText, error, variant = 'default', ...props }: TextInputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  // 라벨·오류 문구를 입력칸에 이어 붙여야 스크린리더·자동화 도구가 칸 이름으로 찾는다
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className={cx('field', { auth: variant === 'auth' })}>
      {label && (
        <div className={cx('label-wrapper')}>
          <label className={cx('input-label')} htmlFor={inputId}>
            {label}
          </label>
          {required && <span className={cx('dot')}>*</span>}
        </div>
      )}
      <div className={cx('input-area', { error })}>
        <input
          aria-describedby={errorText ? errorId : undefined}
          aria-invalid={error || undefined}
          className={cx('input')}
          id={inputId}
          ref={ref}
          suppressHydrationWarning
          {...props}
        />
      </div>
      {errorText ? (
        <span className={cx('input-helperText')} id={errorId} role="alert">
          {errorText}
        </span>
      ) : null}
    </div>
  );
}

export default React.forwardRef(TextInput);
