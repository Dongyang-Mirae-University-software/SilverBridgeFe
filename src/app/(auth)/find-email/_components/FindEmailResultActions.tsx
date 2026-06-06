'use client';

import { useRouter } from 'next/navigation';

import styles from './FindEmailContent.module.css';


export default function FindEmailResultActions() {
  const router = useRouter();

  return (
    <div className={styles.resultActions}>
      <button className={styles.submitButton} type="button" onClick={() => router.push('/login')}>
        로그인하기
      </button>
    </div>
  );
}
