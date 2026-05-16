import { ReactNode } from 'react';

import RoleRouteGuard from '@/app/_components/RoleRouteGuard';

export default function WardLayout({ children }: { children: ReactNode }) {
  return <RoleRouteGuard allowedRole="WARD">{children}</RoleRouteGuard>;
}
