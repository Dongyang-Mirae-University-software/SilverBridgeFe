import PageLayout from '@/components/layout/PageLayout';
import { GuardianMedicationContent } from './_components/GuardianMedicationContent';

export default function GuardianMedicationPage() {
  return (
    <PageLayout scrollContent title="복약 관리" description="오늘 약을 드셨는지 확인하고, 안 드시면 알림을 받아요">
      <GuardianMedicationContent />
    </PageLayout>
  );
}
