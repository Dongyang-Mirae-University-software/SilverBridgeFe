import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import { WardCompanionContent } from './_components/WardCompanionContent';

export const metadata: Metadata = { title: '안부 말벗' };

export default function WardCompanionPage() {
  return (
    <PageLayout title="안부 말벗" hideTitle>
      <WardCompanionContent />
    </PageLayout>
  );
}
