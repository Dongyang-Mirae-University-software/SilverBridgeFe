import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import { GuardianCompanionSessionContent } from '../../_components/GuardianCompanionSessionContent';

export const metadata: Metadata = { title: '대화 보기' };

export default function GuardianCompanionSessionPage() {
  return (
    <PageLayout title="대화 보기" description="안부 대화의 기분과 나눈 이야기를 살펴요">
      <GuardianCompanionSessionContent />
    </PageLayout>
  );
}
