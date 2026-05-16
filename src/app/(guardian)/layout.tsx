import { ReactNode } from 'react';

import RoleRouteGuard from '@/app/_components/RoleRouteGuard';

export default function GuardianLayout({ children }: { children: ReactNode }) {
  return <RoleRouteGuard allowedRole="GUARDIAN">{children}</RoleRouteGuard>;
}
