import PageLayout from '@/components/layout/PageLayout';
import { GuardianConnectionRequestForm } from '../_components/GuardianConnectionRequestForm';
import { GuardianConnectionRequestHistory } from '../_components/GuardianConnectionRequestHistory';
import styles from './page.module.css';

export default function GuardianWardRegisterPage() {
  return (
    <PageLayout title="피보호자 등록" description="피보호자의 회원 ID를 입력하여 연결을 요청합니다">
      <div className={styles.stack}>
        <GuardianConnectionRequestForm />
        <GuardianConnectionRequestHistory />
      </div>
    </PageLayout>
  );
}
