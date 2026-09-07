import PageLayout from '@/components/layout/PageLayout';
import GuardianSosHistoryContent from './_components/GuardianSosHistoryContent';

export default function GuardianSosPage() {
  return (
    <PageLayout title="SOS 이력" description="연결된 피보호자의 긴급 SOS 발생 이력을 확인합니다.">
      <GuardianSosHistoryContent />
    </PageLayout>
  );
}
