import PageLayout from '@/components/layout/PageLayout';
import GuardianMonitorContent from './_components/GuardianMonitorContent';

export default function GuardianDetectionPage() {
  return (
    <PageLayout title="이상감지" description="피보호자의 실시간 영상과 AI 화재·연기 감지 결과를 확인합니다.">
      <GuardianMonitorContent />
    </PageLayout>
  );
}
