import PageLayout from '@/components/layout/PageLayout';
import { GuardianHospitalContent } from './_components/GuardianHospitalContent';

export default function GuardianHospitalPage() {
  return (
    <PageLayout title="병원 예약하기" description="피보호자 병원 예약과 진료 일정을 관리합니다.">
      <GuardianHospitalContent />
    </PageLayout>
  );
}
