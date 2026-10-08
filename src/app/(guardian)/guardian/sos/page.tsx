import PageLayout from '@/components/layout/PageLayout';
import GuardianSosHistoryContent from './_components/GuardianSosHistoryContent';

export default function GuardianSosPage() {
  return (
    <PageLayout title="SOS 이력" description="피보호자가 직접 누른 긴급 호출 기록">
      <GuardianSosHistoryContent />
    </PageLayout>
  );
}
