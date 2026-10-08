import PageLayout from '@/components/layout/PageLayout';
import { WardMedicationContent } from './_components/WardMedicationContent';

export default function WardMedicationPage() {
  return (
    <PageLayout title="오늘 드실 약" description="오늘 약을 드셨는지 확인하고, 안 드시면 알림을 받아요.">
      <WardMedicationContent />
    </PageLayout>
  );
}
