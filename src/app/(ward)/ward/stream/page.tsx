import PageLayout from '@/components/layout/PageLayout';
import WardStreamContent from './_components/WardStreamContent';

export default function WardStreamPage() {
  return (
    <PageLayout title="화면 송출" description="카메라 또는 화면을 AI 서버로 실시간 전송합니다.">
      <WardStreamContent />
    </PageLayout>
  );
}
