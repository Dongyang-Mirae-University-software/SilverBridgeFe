import PageLayout from '@/components/layout/PageLayout';
import GuardianChatContent from './_components/GuardianChatContent';

export default function GuardianChatbotPage() {
  return (
    <PageLayout title="AI 의료 챗봇" description="건강 상담, 병원 예약, 응급 안내를 AI로 도움받으세요.">
      <GuardianChatContent />
    </PageLayout>
  );
}
