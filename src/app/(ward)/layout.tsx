import { ReactNode } from 'react';

import RoleRouteGuard from '@/app/_components/RoleRouteGuard';
import { DashboardLayout } from '@/app/_common/layout/dashboard/DashboardLayout';

export default function WardLayout({ children }: { children: ReactNode }) {
  return (
    <RoleRouteGuard allowedRole="WARD">
      <DashboardLayout role="WARD">{children}</DashboardLayout>
    </RoleRouteGuard>
  );
}
