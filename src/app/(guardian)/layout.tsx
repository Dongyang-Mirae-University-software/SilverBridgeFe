import { ReactNode } from 'react';

import RoleRouteGuard from '@/components/RoleRouteGuard';
import { GuardianLayout } from './guardian/_components/GuardianLayout';

export default function GuardianRootLayout({ children }: { children: ReactNode }) {
  return (
    <RoleRouteGuard allowedRole="GUARDIAN">
      <GuardianLayout>{children}</GuardianLayout>
    </RoleRouteGuard>
  );
}
