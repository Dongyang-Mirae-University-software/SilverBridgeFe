'use client';

import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import FindEmailContent from '../../find-email/_components/FindEmailContent';
import styles from './FindEmailModal.module.css';

const cx = classNames.bind(styles);

export default function FindEmailModalPage() {
  const router = useRouter();
  const closeModal = () => router.back();

  return (
    <div className={cx('backdrop')} role="presentation" onClick={closeModal}>
      <section
        aria-label="아이디 찾기"
        aria-modal="true"
        className={cx('dialog')}
        role="dialog"
        onClick={event => event.stopPropagation()}
      >
        <FindEmailContent onClose={closeModal} />
      </section>
    </div>
  );
}
