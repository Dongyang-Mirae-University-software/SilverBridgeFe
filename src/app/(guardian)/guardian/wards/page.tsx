import PageLayout from '@/components/layout/PageLayout';
import { GuardianWardsPanel } from '@/components/connections/GuardianWardsPanel';

export default function GuardianWardsPage() {
  return (
    <PageLayout title="피보호자 관리" description="연결된 피보호자 목록과 새 연결 요청을 한 곳에서 관리합니다.">
      <GuardianWardsPanel />
    </PageLayout>
  );
}
