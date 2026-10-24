import PageLayout from '@/components/layout/PageLayout';
import { WardMedicationContent } from './_components/WardMedicationContent';

export default function WardMedicationPage() {
  return (
    <PageLayout title="오늘 먹을 약" description="약을 먹고 나면 버튼을 눌러 주세요. 보호자에게도 알려 드려요.">
      <WardMedicationContent />
    </PageLayout>
  );
}
