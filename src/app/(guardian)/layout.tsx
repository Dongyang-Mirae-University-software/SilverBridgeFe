import { ReactNode } from 'react';

import RoleRouteGuard from '@/app/_components/RoleRouteGuard';
import { DashboardLayout } from '@/app/_common/layout/dashboard/DashboardLayout';

export default function GuardianLayout({ children }: { children: ReactNode }) {
  return (
    <RoleRouteGuard allowedRole="GUARDIAN">
      <DashboardLayout role="GUARDIAN">{children}</DashboardLayout>
    </RoleRouteGuard>
  );
}
