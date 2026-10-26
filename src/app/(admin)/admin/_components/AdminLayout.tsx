'use client';

import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { SidebarLayout } from '@/components/layout/dashboard/SidebarLayout';
import { ADMIN_NAV } from '@/constants/dashboard';
import { myProfileQueryOptions } from '@/service/query/user';
import { getUserProfileData } from '@/utils/auth/userProfile';
import styles from './AdminLayout.module.css';

const cx = classNames.bind(styles);

export function AdminLayout({ children }: { children: ReactNode }) {
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);

  return (
    <div className={cx('stage')}>
      <SidebarLayout navItems={ADMIN_NAV} profile={profile} role="ADMIN" rootPath="/admin" />
      <main className={cx('main')}>{children}</main>
    </div>
  );
}
