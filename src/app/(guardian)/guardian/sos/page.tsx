import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import GuardianSosHistoryContent from './_components/GuardianSosHistoryContent';

export const metadata: Metadata = { title: 'SOS 이력' };

export default function GuardianSosPage() {
  return (
    <PageLayout title="SOS 이력" description="어르신이 직접 누른 긴급 호출 기록">
      <GuardianSosHistoryContent />
    </PageLayout>
  );
}
