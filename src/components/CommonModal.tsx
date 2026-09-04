'use client';

import classNames from 'classnames/bind';

import styles from './CommonModal.module.css';

const cx = classNames.bind(styles);

export type CommonModalType = 'info' | 'success' | 'warning' | 'error';
export type CommonModalTone = 'default' | 'guardian';

interface CommonModalProps {
  type?: CommonModalType;
  tone?: CommonModalTone;
  title?: string;
  message: string;
  confirmText?: string;
  confirmDisabled?: boolean;
  secondaryText?: string;
  secondaryDisabled?: boolean;
  onConfirm?: () => void;
  onSecondary?: () => void;
  onClose: () => void;
}

const MODAL_LABELS: Record<CommonModalType, string> = {
  info: '안내',
  success: '완료',
  warning: '주의',
  error: '오류',
};

const MODAL_ICONS: Record<CommonModalType, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  error: '!',
};

export function CommonModal({
  type = 'info',
  tone = 'default',
  title,
  message,
  confirmText = '확인',
  confirmDisabled = false,
  secondaryText,
  secondaryDisabled = false,
  onConfirm,
  onSecondary,
  onClose,
}: CommonModalProps) {
  return (
    <div className={cx('overlay')} role="presentation" onClick={secondaryText ? onSecondary ?? onClose : onClose}>
      <section
        className={cx('modal', type, { guardianTone: tone === 'guardian' })}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="common-modal-title"
        aria-describedby="common-modal-message"
        onClick={event => event.stopPropagation()}
      >
        <div className={cx('icon')} aria-hidden="true">
          {MODAL_ICONS[type]}
        </div>
        <div className={cx('content')}>
          <h2 id="common-modal-title">{title || MODAL_LABELS[type]}</h2>
          <p id="common-modal-message">{message}</p>
        </div>
        <div className={cx('actions')}>
          {secondaryText && onSecondary && (
            <button
              className={cx('button', 'secondaryButton')}
              type="button"
              disabled={secondaryDisabled}
              onClick={onSecondary}
            >
              {secondaryText}
            </button>
          )}
          <button className={cx('button')} type="button" disabled={confirmDisabled} onClick={onConfirm ?? onClose}>
            {confirmText}
          </button>
        </div>
      </section>
    </div>
  );
}
