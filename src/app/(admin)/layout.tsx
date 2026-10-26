import { ReactNode } from 'react';

import RoleRouteGuard from '@/components/RoleRouteGuard';
import { AdminLayout } from './admin/_components/AdminLayout';

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <RoleRouteGuard allowedRole="ADMIN">
      <AdminLayout>{children}</AdminLayout>
    </RoleRouteGuard>
  );
}
