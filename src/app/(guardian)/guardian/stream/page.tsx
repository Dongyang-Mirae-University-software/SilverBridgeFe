import PageLayout from '@/components/layout/PageLayout';
import Stream from './_components/Stream';

export default function StreamPage() {
  return (
    <PageLayout title="화면 송출" description="카메라나 화면을 선택하고 보호자에게 실시간으로 공유하세요.">
      <Stream />
    </PageLayout>
  );
}
