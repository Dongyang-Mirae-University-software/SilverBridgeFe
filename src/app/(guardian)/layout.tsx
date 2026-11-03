import { ReactNode } from 'react';

import RoleRouteGuard from '@/components/RoleRouteGuard';
import { GuardianLayout } from './guardian/_components/GuardianLayout';

export default function GuardianRootLayout({ children }: { children: ReactNode }) {
  return (
    <RoleRouteGuard allowedRole="GUARDIAN" roleMismatchMessage="가족 등록은 보호자 계정에서만 할 수 있어요.">
      <GuardianLayout>{children}</GuardianLayout>
    </RoleRouteGuard>
  );
}
