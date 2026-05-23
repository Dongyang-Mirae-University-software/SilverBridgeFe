import PageLayout from '@/components/layout/PageLayout';
import { WardGuardiansPanel } from '@/components/app/connections/WardGuardiansPanel';

export default function WardGuardiansPage() {
  return (
    <PageLayout title="내 보호자" description="보호자 연결 요청을 확인하고 현재 연결된 보호자를 관리합니다.">
      <WardGuardiansPanel />
    </PageLayout>
  );
}
