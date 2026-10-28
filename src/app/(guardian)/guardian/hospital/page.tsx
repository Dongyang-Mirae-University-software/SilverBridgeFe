import PageLayout from '@/components/layout/PageLayout';
import { GuardianHospitalContent } from './_components/GuardianHospitalContent';

export default function GuardianHospitalPage() {
  return (
    <PageLayout title="병원 예약">
      <GuardianHospitalContent />
    </PageLayout>
  );
}
