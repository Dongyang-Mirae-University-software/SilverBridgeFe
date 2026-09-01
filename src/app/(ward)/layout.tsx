import { ReactNode } from 'react';

import RoleRouteGuard from '@/components/RoleRouteGuard';
import { WardLayout } from './ward/_components/WardLayout';

export default function layout({ children }: { children: ReactNode }) {
  return (
    <RoleRouteGuard allowedRole="WARD">
      <WardLayout>{children}</WardLayout>
    </RoleRouteGuard>
  );
}
