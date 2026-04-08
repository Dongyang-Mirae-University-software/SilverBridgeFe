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
  { label, required = true, errorText, error, ...props }: TextInputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  return (
    <div>
      {label && (
        <div className={cx('label-wrapper')}>
          <label className={cx('input-label')}>{label}</label>
          {required && <span className={cx('dot')}>*</span>}
        </div>
      )}
      <div className={cx('input-area')} ref={ref as React.RefObject<HTMLDivElement>}>
        <input className={cx('input', { error })} {...props} />
      </div>
      {/* {error && (
        <span className={cx('input-helperText')}>
          <i name="icon-info-error" size={16} />
          {errorText}
        </span>
      )} */}
    </div>
  );
}

export default React.forwardRef(TextInput);
