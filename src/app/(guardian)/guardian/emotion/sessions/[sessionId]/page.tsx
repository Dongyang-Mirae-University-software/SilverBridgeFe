import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import { GuardianCompanionSessionContent } from '../../_components/GuardianCompanionSessionContent';

export const metadata: Metadata = { title: '대화 보기' };

export default function GuardianCompanionSessionPage() {
  return (
    <PageLayout title="대화 보기">
      <GuardianCompanionSessionContent />
    </PageLayout>
  );
}
