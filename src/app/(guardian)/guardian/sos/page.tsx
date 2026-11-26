import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import GuardianSosHistoryContent from './_components/GuardianSosHistoryContent';

export const metadata: Metadata = { title: 'SOS 이력' };

export default function GuardianSosPage() {
  return (
    <PageLayout title="SOS 이력">
      <GuardianSosHistoryContent />
    </PageLayout>
  );
}
