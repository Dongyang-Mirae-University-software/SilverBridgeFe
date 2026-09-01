import PageLayout from '@/components/layout/PageLayout';
import { NoticesPage } from '@/components/notices/NoticesPage';

export default function GuardianNoticesPage() {
  return (
    <PageLayout title="공지사항" description="서비스 안내와 중요한 공지 내용을 확인합니다.">
      <NoticesPage />
    </PageLayout>
  );
}
