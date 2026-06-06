'use client';

import { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import useFindEmailFlow from '../_hooks/useFindEmailFlow';
import FindEmailInfoStep from './FindEmailInfoStep';
import FindEmailResultStep from './FindEmailResultStep';
import styles from './FindEmailContent.module.css';


export default function FindEmailContent() {
  const flow = useFindEmailFlow();
  const router = useRouter();

  const handleInfoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await flow.requestEmail(flow.form);
  };

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>아이디 찾기</h1>
        <button className={styles.closeButton} type="button" onClick={() => router.push('/login')}>
          ✕
        </button>
      </div>

      {flow.step === 1 && (
        <FindEmailInfoStep
          errorMessage={flow.errorMessage}
          form={flow.form}
          isPending={flow.isRequesting}
          onChange={flow.setForm}
          onSubmit={handleInfoSubmit}
        />
      )}
      {flow.step === 2 && flow.result && <FindEmailResultStep result={flow.result} />}
    </>
  );
}
