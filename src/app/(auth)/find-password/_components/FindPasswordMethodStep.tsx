'use client';


import styles from './FindPasswordMethodStep.module.css';


type Method = 'email' | 'sms';

interface Props {
  onSelectMethod: (method: Method) => void;
}

export default function FindPasswordMethodStep({ onSelectMethod }: Props) {
  return (
    <div className={styles.section}>
      <h2 className={styles.stepTitle}>비밀번호 찾기 방식 선택</h2>
      <p className={styles.description}>비밀번호를 찾을 방법을 선택하세요.</p>
      <div className={styles.methodButtons}>
        <button className={styles.methodButton} onClick={() => onSelectMethod('email')}>
          <span className={styles.methodIcon}>✉</span>
          <span>
            <strong>이메일 인증</strong>
            <small>가입 이메일로 코드 발송</small>
          </span>
        </button>
        <button className={styles.methodButton} onClick={() => onSelectMethod('sms')}>
          <span className={styles.methodIcon}>▣</span>
          <span>
            <strong>SMS 인증</strong>
            <small>등록한 휴대폰으로 발송</small>
          </span>
        </button>
      </div>
    </div>
  );
}
