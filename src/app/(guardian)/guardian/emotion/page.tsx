import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import { GuardianEmotionContent } from './_components/GuardianEmotionContent';

export const metadata: Metadata = { title: 'AI 기분 체크' };

export default function GuardianEmotionPage() {
  return (
    <PageLayout title="AI 기분 체크">
      <GuardianEmotionContent />
    </PageLayout>
  );
}
