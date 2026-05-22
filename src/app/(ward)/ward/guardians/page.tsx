import PageLayout from '@/components/layout/PageLayout';
import { WardGuardiansPanel } from '@/components/app/connections/WardGuardiansPanel';

export default function WardGuardiansPage() {
  return (
    <PageLayout title="내 보호자">
      <WardGuardiansPanel />
    </PageLayout>
  );
}
