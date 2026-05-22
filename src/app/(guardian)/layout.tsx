import { ReactNode } from 'react';

import RoleRouteGuard from '@/components/RoleRouteGuard';
import { DashboardLayout } from '@/components/layout/dashboard/DashboardLayout';

export default function GuardianLayout({ children }: { children: ReactNode }) {
  return (
    <RoleRouteGuard allowedRole="GUARDIAN">
      <DashboardLayout>{children}</DashboardLayout>
    </RoleRouteGuard>
  );
}
