import PageLayout from '@/components/layout/PageLayout';
import { WardCameraContent } from './_components/WardCameraContent';

export default function WardCameraPage() {
  return (
    <PageLayout title="카메라 등록" description="방을 고르면 그 공간의 카메라가 보호자에게 연결됩니다.">
      <WardCameraContent />
    </PageLayout>
  );
}
