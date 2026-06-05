import React, { ForwardedRef, InputHTMLAttributes } from 'react';
import clsx from 'clsx';

import styles from './TextInput.module.css';

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
    <div className={styles.field}>
      {label && (
        <div className={styles['label-wrapper']}>
          <label className={styles['input-label']}>{label}</label>
          {required && <span className={styles.dot}>*</span>}
        </div>
      )}
      <div className={clsx(styles['input-area'], { [styles.error]: error })}>
        <input className={styles.input} ref={ref} {...props} />
      </div>
      {errorText ? (
        <span className={styles['input-helperText']} role="alert">
          {errorText}
        </span>
      ) : null}
    </div>
  );
}

export default React.forwardRef(TextInput);
