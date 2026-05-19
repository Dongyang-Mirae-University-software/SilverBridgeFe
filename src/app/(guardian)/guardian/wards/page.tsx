import { GuardianWardsPanel } from '@/app/_components/app/ConnectionPanels';
import UserDashboard from '@/app/_components/app/UserDashboard';

export default function GuardianWardsPage() {
  return (
    <UserDashboard pageKey="wards" role="GUARDIAN">
      <GuardianWardsPanel />
    </UserDashboard>
  );
}
