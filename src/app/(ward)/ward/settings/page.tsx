import PageLayout from '@/components/layout/PageLayout';
import { WardSettingsContent } from './_components/WardSettingsContent';

export default function WardSettingsPage() {
  return (
    <PageLayout title="환경설정">
      <WardSettingsContent />
    </PageLayout>
  );
}
