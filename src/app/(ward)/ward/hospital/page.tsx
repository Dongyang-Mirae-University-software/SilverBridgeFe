import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import { WardHospitalContent } from './_components/WardHospitalContent';

export const metadata: Metadata = { title: '병원 가는 날' };

export default function WardHospitalPage() {
  return (
    <PageLayout title="병원 가는 날" hideTitle>
      <WardHospitalContent />
    </PageLayout>
  );
}
