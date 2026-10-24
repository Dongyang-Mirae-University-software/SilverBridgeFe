import PageLayout from '@/components/layout/PageLayout';
import { WardGuardiansPanel } from '@/app/(ward)/ward/guardians/_components/WardGuardiansPanel';

export default function WardGuardiansPage() {
  return (
    <PageLayout title="내 가족">
      <WardGuardiansPanel />
    </PageLayout>
  );
}
