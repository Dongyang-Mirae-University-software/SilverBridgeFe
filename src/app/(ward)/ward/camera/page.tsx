import PageLayout from '@/components/layout/PageLayout';
import { WardCameraContent } from './_components/WardCameraContent';

export default function WardCameraPage() {
  return (
    <PageLayout title="내 카메라" description="집 안 카메라를 등록하고 화재·넘어짐 같은 이상 상황을 보호자에게 알려드려요.">
      <WardCameraContent />
    </PageLayout>
  );
}
