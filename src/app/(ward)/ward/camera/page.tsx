import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import { WardCameraContent } from './_components/WardCameraContent';

export const metadata: Metadata = { title: '내 카메라' };

export default function WardCameraPage() {
  return (
    <PageLayout title="내 카메라">
      <WardCameraContent />
    </PageLayout>
  );
}
