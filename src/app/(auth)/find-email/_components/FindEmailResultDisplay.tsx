'use client';


import { IFindEmailResponse } from '@/service/interface/auth';
import styles from './FindEmailContent.module.css';


interface Props {
  result: IFindEmailResponse;
}

export default function FindEmailResultDisplay({ result }: Props) {
  const email = result.maskedEmail ?? (result.hasKakaoAccount ? '카카오 계정' : '가입 정보 없음');

  return (
    <div className={styles.resultBox}>
      <div className={styles.resultLabel}>회원님의 아이디</div>
      <div className={styles.resultEmail}>{email}</div>
      {result.createdAt && <div className={styles.resultDate}>가입일 {result.createdAt}</div>}
    </div>
  );
}
