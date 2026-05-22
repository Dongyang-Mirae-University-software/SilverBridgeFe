import PageLayout from '@/components/layout/PageLayout';
import { GuardianWardsPanel } from '@/components/app/connections/GuardianWardsPanel';

export default function GuardianWardsPage() {
  return (
    <PageLayout title="피보호자 관리">
      <GuardianWardsPanel />
    </PageLayout>
  );
}
