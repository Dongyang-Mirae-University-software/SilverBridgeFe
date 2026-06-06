import React, { ForwardedRef, InputHTMLAttributes } from 'react';
import classNames from 'classnames/bind';

import styles from './TextInput.module.css';

const cx = classNames.bind(styles);

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  errorText?: string;
  required?: boolean;
  label?: string;
}

function TextInput(
  { label, required = false, errorText, error, ...props }: TextInputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  return (
    <div className={cx('field')}>
      {label && (
        <div className={cx('label-wrapper')}>
          <label className={cx('input-label')}>{label}</label>
          {required && <span className={cx('dot')}>*</span>}
        </div>
      )}
      <div className={cx('input-area', { error })}>
        <input className={cx('input')} ref={ref} {...props} />
      </div>
      {errorText ? (
        <span className={cx('input-helperText')} role="alert">
          {errorText}
        </span>
      ) : null}
    </div>
  );
}

export default React.forwardRef(TextInput);
