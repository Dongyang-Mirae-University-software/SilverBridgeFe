import PageLayout from '@/components/layout/PageLayout';
import { WardHospitalContent } from './_components/WardHospitalContent';

export default function WardHospitalPage() {
  return (
    <PageLayout title="병원 예약 현황" description="보호자가 잡아 드린 병원 예약과 진료 일정을 확인합니다.">
      <WardHospitalContent />
    </PageLayout>
  );
}
