import PageLayout from '@/components/layout/PageLayout';
import { WardGuardiansPanel } from '@/app/(ward)/ward/guardians/_components/WardGuardiansPanel';

export default function WardGuardiansPage() {
  return (
    <PageLayout title="내 보호자" description="비상시 연결되는 보호자 및 연결 요청을 관리합니다.">
      <WardGuardiansPanel />
    </PageLayout>
  );
}
