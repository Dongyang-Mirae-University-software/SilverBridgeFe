import UserDashboard from '@/app/_components/app/UserDashboard';
import { NoticesPanel } from '@/app/_components/app/NoticesPanel';

export default function WardNoticesPage() {
  return (
    <UserDashboard pageKey="notices" role="WARD">
      <NoticesPanel />
    </UserDashboard>
  );
}
