import { GuardianWardsPanel } from '@/app/_components/app/connections/GuardianWardsPanel';
import UserDashboard from '@/app/_components/app/UserDashboard';

export default function GuardianWardRegisterPage() {
  return (
    <UserDashboard pageKey="ward-register" role="GUARDIAN">
      <GuardianWardsPanel initialTab="register" />
    </UserDashboard>
  );
}
