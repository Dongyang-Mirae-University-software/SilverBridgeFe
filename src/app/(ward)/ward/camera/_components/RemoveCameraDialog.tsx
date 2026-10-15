'use client';

import classNames from 'classnames/bind';

import styles from './RemoveCameraDialog.module.css';

const cx = classNames.bind(styles);

// 카메라 등록 해제 확인창. 해제는 되돌릴 수 없고 저장된 영상까지 지워지므로 한 번 더 묻는다.
export function RemoveCameraDialog({
  label,
  isThisDevice,
  isPending,
  onCancel,
  onConfirm,
}: {
  label: string;
  isThisDevice: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={cx('overlay')} role="presentation" onClick={isPending ? undefined : onCancel}>
      <section
        className={cx('dialog')}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-camera-title"
        aria-describedby="remove-camera-message"
        onClick={event => event.stopPropagation()}
      >
        <h2 id="remove-camera-title">{label} 카메라 등록을 해제할까요?</h2>
        <p id="remove-camera-message">
          해제하면 이 방의 이상 상황 알림이 오지 않고, 저장된 영상도 지워져요.
          {isThisDevice && ' 이 기기의 촬영도 꺼져요.'}
        </p>
        <div className={cx('actions')}>
          <button type="button" className={cx('cancelButton')} disabled={isPending} onClick={onCancel}>
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
