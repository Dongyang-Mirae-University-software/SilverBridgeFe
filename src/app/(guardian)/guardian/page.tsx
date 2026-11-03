import type { Metadata } from 'next';
import { GuardianDashboardContent } from './_components/GuardianDashboardContent';

export const metadata: Metadata = { title: '보호자 대시보드' };

export default function GuardianPage() {
  return <GuardianDashboardContent />;
}
