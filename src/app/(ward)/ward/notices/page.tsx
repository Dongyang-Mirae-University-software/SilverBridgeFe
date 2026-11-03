import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import { NoticesPage } from '@/components/notices/NoticesPage';

export const metadata: Metadata = { title: '공지사항' };

export default function WardNoticesPage() {
  return (
    <PageLayout title="공지사항" hideTitle>
      <NoticesPage variant="ward" />
    </PageLayout>
  );
}
