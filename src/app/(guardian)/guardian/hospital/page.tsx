import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import { GuardianHospitalContent } from './_components/GuardianHospitalContent';

export const metadata: Metadata = { title: '병원 예약' };

export default function GuardianHospitalPage() {
  return (
    <PageLayout title="병원 예약">
      <GuardianHospitalContent />
    </PageLayout>
  );
}
