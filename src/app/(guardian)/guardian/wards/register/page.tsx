import PageLayout from '@/components/layout/PageLayout';
import { GuardianConnectionRequestForm } from '../_components/GuardianConnectionRequestForm';
import { GuardianConnectionRequestHistory } from '../_components/GuardianConnectionRequestHistory';
import styles from './page.module.css';

export default function GuardianWardRegisterPage() {
  return (
    <PageLayout title="가족 등록">
      <div className={styles.stack}>
        <GuardianConnectionRequestForm />
        <GuardianConnectionRequestHistory />
      </div>
    </PageLayout>
  );
}
