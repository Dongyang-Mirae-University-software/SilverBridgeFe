import PageLayout from '@/components/layout/PageLayout';
import { NoticesPage } from '@/components/notices/NoticesPage';

export default function GuardianNoticesPage() {
  return (
    <PageLayout title="공지사항" description="SilverBridge에서 알려드려요">
      <NoticesPage />
    </PageLayout>
  );
}
