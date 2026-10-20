'use client';

import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import FindPasswordContent from '../../find-password/_components/FindPasswordContent';
import styles from './FindPasswordModal.module.css';

const cx = classNames.bind(styles);

export default function FindPasswordModalPage() {
  const router = useRouter();
  const closeModal = () => router.back();

  return (
    <div className={cx('backdrop')} role="presentation" onClick={closeModal}>
      <section
        aria-label="비밀번호 찾기"
        aria-modal="true"
        className={cx('dialog')}
        role="dialog"
        onClick={event => event.stopPropagation()}
      >
        <FindPasswordContent onClose={closeModal} />
      </section>
    </div>
  );
}
