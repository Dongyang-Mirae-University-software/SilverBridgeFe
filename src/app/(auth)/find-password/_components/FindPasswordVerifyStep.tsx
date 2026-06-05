'use client';


import VerificationCodeForm from '@/app/(auth)/_components/VerificationCodeForm';
import styles from './FindPasswordVerifyStep.module.css';


interface Props {
  codeLength: number;
  errorMessage: string;
  expiresInSeconds: number;
  onResend: () => Promise<unknown>;
  onSubmit: (code: string) => Promise<unknown>;
}

export default function FindPasswordVerifyStep({ codeLength, errorMessage, expiresInSeconds, onResend, onSubmit }: Props) {
  return (
    <div className={styles.section}>
      <VerificationCodeForm
        content="받은 인증코드를 입력하세요."
        codeLength={codeLength}
        errorMessage={errorMessage}
        expiresInSeconds={expiresInSeconds}
        onResend={onResend}
        onSubmit={onSubmit}
      />
    </div>
  );
}
