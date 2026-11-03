import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import { WardGuardiansPanel } from '@/app/(ward)/ward/guardians/_components/WardGuardiansPanel';

export const metadata: Metadata = { title: '내 가족' };

export default function WardGuardiansPage() {
  return (
    <PageLayout title="내 가족">
      <WardGuardiansPanel />
    </PageLayout>
  );
}
