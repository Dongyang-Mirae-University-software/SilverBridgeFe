import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import GuardianSettingsContent from './_components/GuardianSettingsContent';

export const metadata: Metadata = { title: '환경설정' };

export default function GuardianSettingsPage() {
  return (
    <PageLayout title="환경설정">
      <GuardianSettingsContent />
    </PageLayout>
  );
}
