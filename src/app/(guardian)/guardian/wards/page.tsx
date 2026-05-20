import { GuardianWardsPanel } from '@/app/_components/app/connections/GuardianWardsPanel';
import UserDashboard from '@/app/_components/app/UserDashboard';

export default function GuardianWardsPage() {
  return (
    <UserDashboard pageKey="wards" role="GUARDIAN">
      <GuardianWardsPanel />
    </UserDashboard>
  );
}
