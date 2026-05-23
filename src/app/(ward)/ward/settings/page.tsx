import PageLayout from '@/components/layout/PageLayout';
import { WardSettingsContent } from './_components/WardSettingsContent';

export default function WardSettingsPage() {
  return (
    <PageLayout title="환경설정" description="글자 크기, 화면 대비, 긴급 SOS 동작 방식을 설정합니다.">
      <WardSettingsContent />
    </PageLayout>
  );
}
