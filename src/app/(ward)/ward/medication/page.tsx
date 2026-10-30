import PageLayout from '@/components/layout/PageLayout';
import { WardMedicationContent } from './_components/WardMedicationContent';

export default function WardMedicationPage() {
  return (
    <PageLayout title="오늘 먹을 약" hideTitle>
      <WardMedicationContent />
    </PageLayout>
  );
}
