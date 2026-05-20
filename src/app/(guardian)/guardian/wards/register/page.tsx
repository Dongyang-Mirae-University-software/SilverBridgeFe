import { GuardianWardRegisterPanel } from '@/app/_components/app/connections/GuardianWardRegisterPanel';
import UserDashboard from '@/app/_components/app/UserDashboard';

export default function GuardianWardRegisterPage() {
  return (
    <UserDashboard pageKey="ward-register" role="GUARDIAN">
      <GuardianWardRegisterPanel />
    </UserDashboard>
  );
}
