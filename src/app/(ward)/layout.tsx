import { ReactNode } from 'react';

import RoleRouteGuard from '@/components/RoleRouteGuard';
import { DashboardLayout } from '@/components/layout/dashboard/DashboardLayout';

export default function WardLayout({ children }: { children: ReactNode }) {
  return (
    <RoleRouteGuard allowedRole="WARD">
      <DashboardLayout>{children}</DashboardLayout>
    </RoleRouteGuard>
  );
}
