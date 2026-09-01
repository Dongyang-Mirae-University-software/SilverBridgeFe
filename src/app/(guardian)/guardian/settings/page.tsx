import PageLayout from '@/components/layout/PageLayout';
import GuardianSettingsContent from './_components/GuardianSettingsContent';

export default function GuardianSettingsPage() {
  return (
    <PageLayout title="환경설정" description="알림 설정과 계정을 관리합니다.">
      <GuardianSettingsContent />
    </PageLayout>
  );
}
