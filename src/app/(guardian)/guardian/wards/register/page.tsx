import PageLayout from '@/components/layout/PageLayout';
import { GuardianWardsPanel } from '@/components/app/connections/GuardianWardsPanel';

export default function GuardianWardRegisterPage() {
  return (
    <PageLayout title="피보호자 관리" description="피보호자 회원 ID로 새 연결 요청을 보냅니다.">
      <GuardianWardsPanel initialTab="register" />
    </PageLayout>
  );
}
