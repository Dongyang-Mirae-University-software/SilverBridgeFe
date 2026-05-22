import PageLayout from '@/components/layout/PageLayout';
import { GuardianWardsPanel } from '@/components/app/connections/GuardianWardsPanel';

export default function GuardianWardRegisterPage() {
  return (
    <PageLayout title="피보호자 등록">
      <GuardianWardsPanel initialTab="register" />
    </PageLayout>
  );
}
