'use client';

import classNames from 'classnames/bind';
import { useEffect, useRef } from 'react';

import styles from './RemoveCameraDialog.module.css';

const cx = classNames.bind(styles);

// 카메라 등록 해제 확인창. 해제는 되돌릴 수 없으므로 한 번 더 묻는다(제목만 보여 준다).
export function RemoveCameraDialog({
  label,
  isPending,
  onCancel,
  onConfirm,
}: {
  label: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 열리면 취소에 포커스(되돌릴 수 없는 해제를 Enter 한 번에 누르지 않게), Esc = 취소, Tab은 창 안에서만 돈다
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (!isPending) onCancel();
        return;
      }
      const dialog = dialogRef.current;
      if (event.key !== 'Tab' || !dialog) return;
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      if (buttons.length === 0) {
        event.preventDefault();
        return;
      }
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPending, onCancel]);

  return (
    <div className={cx('overlay')} role="presentation" onClick={isPending ? undefined : onCancel}>
      <section
        ref={dialogRef}
        className={cx('dialog')}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-camera-title"
        onClick={event => event.stopPropagation()}
      >
        <h2 id="remove-camera-title">{label} 카메라 등록을 해제할까요?</h2>
        <div className={cx('actions')}>
          <button ref={cancelRef} type="button" className={cx('cancelButton')} disabled={isPending} onClick={onCancel}>
            취소
          </button>
          <button type="button" className={cx('confirmButton')} disabled={isPending} onClick={onConfirm}>
            {isPending ? '해제하는 중...' : '등록 해제'}
          </button>
        </div>
      </section>
    </div>
  );
}
