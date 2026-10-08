import PageLayout from '@/components/layout/PageLayout';
import { WardSettingsContent } from './_components/WardSettingsContent';

export default function WardSettingsPage() {
  return (
    <PageLayout title="환경설정" description="글자 크기, 화면, 긴급 SOS 방식을 정해요">
      <WardSettingsContent />
    </PageLayout>
  );
}
