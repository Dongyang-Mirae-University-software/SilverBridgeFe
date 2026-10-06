'use client';

import classNames from 'classnames/bind';

import useToastStore from '@/store/toastStore';
import styles from './ToastHost.module.css';

const cx = classNames.bind(styles);

export function ToastHost() {
  const toasts = useToastStore(state => state.toasts);
  const dismissToast = useToastStore(state => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className={cx('area')} aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} className={cx('toast', toast.variant)} role="alert">
          <span className={cx('message')}>{toast.message}</span>
          <button
            className={cx('dismissButton')}
            type="button"
            aria-label="알림 닫기"
            onClick={() => dismissToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
