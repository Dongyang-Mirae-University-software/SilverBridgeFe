import type { Metadata } from 'next';
import PageLayout from '@/components/layout/PageLayout';
import { GuardianGameContent } from './_components/GuardianGameContent';

export const metadata: Metadata = { title: '게임 관리' };

export default function GuardianGamePage() {
  return (
    <PageLayout title="게임 관리" description="피보호자의 치매 예방 게임 진행 상황과 점수를 확인합니다.">
      <GuardianGameContent />
    </PageLayout>
  );
}
