'use client';

import clsx from 'clsx';

import styles from './CommonModal.module.css';

export type CommonModalType = 'info' | 'success' | 'warning' | 'error';
export type CommonModalTone = 'default' | 'guardian';

interface CommonModalProps {
  type?: CommonModalType;
  tone?: CommonModalTone;
  title?: string;
  message: string;
  confirmText?: string;
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

export function CommonModal({ type = 'info', tone = 'default', title, message, confirmText = '확인', onClose }: CommonModalProps) {
  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <section
        className={clsx(styles.modal, styles[type], { [styles.guardianTone]: tone === 'guardian' })}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="common-modal-title"
        aria-describedby="common-modal-message"
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.icon} aria-hidden="true">
          {MODAL_ICONS[type]}
        </div>
        <div className={styles.content}>
          <h2 id="common-modal-title">{title || MODAL_LABELS[type]}</h2>
          <p id="common-modal-message">{message}</p>
        </div>
        <button className={styles.button} type="button" onClick={onClose}>
          {confirmText}
        </button>
      </section>
    </div>
  );
}
