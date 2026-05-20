import { WardGuardiansPanel } from '@/app/_components/app/connections/WardGuardiansPanel';
import UserDashboard from '@/app/_components/app/UserDashboard';

export default function WardGuardiansPage() {
  return (
    <UserDashboard pageKey="guardians" role="WARD">
      <WardGuardiansPanel />
    </UserDashboard>
  );
}
