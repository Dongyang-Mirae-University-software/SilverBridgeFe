import UserDashboard from '@/app/_components/app/UserDashboard';
import { NoticesPanel } from '@/app/_components/app/NoticesPanel';

export default function GuardianNoticesPage() {
  return (
    <UserDashboard pageKey="notices" role="GUARDIAN">
      <NoticesPanel />
    </UserDashboard>
  );
}
