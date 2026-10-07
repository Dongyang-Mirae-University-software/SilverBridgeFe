import PageLayout from '@/components/layout/PageLayout';
import GuardianSettingsContent from './_components/GuardianSettingsContent';

export default function GuardianSettingsPage() {
  return (
    <PageLayout title="환경설정" description="알림 · 계정 설정">
      <GuardianSettingsContent />
    </PageLayout>
  );
}
