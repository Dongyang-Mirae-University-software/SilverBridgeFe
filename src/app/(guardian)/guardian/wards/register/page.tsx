import { GuardianWardRegisterPanel } from '@/app/_components/app/ConnectionPanels';
import UserDashboard from '@/app/_components/app/UserDashboard';

export default function GuardianWardRegisterPage() {
  return (
    <UserDashboard pageKey="ward-register" role="GUARDIAN">
      <GuardianWardRegisterPanel />
    </UserDashboard>
  );
}
