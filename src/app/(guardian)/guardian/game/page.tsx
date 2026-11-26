import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import { GuardianGameContent } from './_components/GuardianGameContent';

export const metadata: Metadata = { title: '게임 관리' };

export default function GuardianGamePage() {
  return (
    <PageLayout title="게임 관리">
      <GuardianGameContent />
    </PageLayout>
  );
}
