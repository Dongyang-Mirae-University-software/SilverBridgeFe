import PageLayout from '@/components/layout/PageLayout';
import { GuardianMedicationContent } from './_components/GuardianMedicationContent';

export default function GuardianMedicationPage() {
  return (
    <PageLayout title="복약 관리" description="연결된 피보호자의 복약 일정과 복용 현황을 관리합니다.">
      <GuardianMedicationContent />
    </PageLayout>
  );
}
