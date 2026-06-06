'use client';


import { IFindEmailResponse } from '@/service/interface/auth';
import FindEmailResultActions from './FindEmailResultActions';
import FindEmailResultDisplay from './FindEmailResultDisplay';
import styles from './FindEmailContent.module.css';


interface Props {
  result: IFindEmailResponse;
}

export default function FindEmailResultStep({ result }: Props) {
  return (
    <div className={styles.section}>
      <FindEmailResultDisplay result={result} />
      <FindEmailResultActions />
    </div>
  );
}
