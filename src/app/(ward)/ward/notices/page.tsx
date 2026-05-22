import PageLayout from '@/components/layout/PageLayout';
import { NoticesPanel } from '@/components/app/NoticesPanel';

export default function WardNoticesPage() {
  return (
    <PageLayout title="공지사항">
      <NoticesPanel />
    </PageLayout>
  );
}
