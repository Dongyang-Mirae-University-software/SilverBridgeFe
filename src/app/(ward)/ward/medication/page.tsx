import PageLayout from '@/components/layout/PageLayout';
import { WardMedicationContent } from './_components/WardMedicationContent';

export default function WardMedicationPage() {
  return (
    <PageLayout title="오늘 드실 약" description="약을 먹고 나면 버튼을 눌러 주세요. 연결된 보호자 화면에도 바로 보여요.">
      <WardMedicationContent />
    </PageLayout>
  );
}
