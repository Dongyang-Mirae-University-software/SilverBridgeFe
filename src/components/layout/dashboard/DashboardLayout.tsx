'use client';

import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { myProfileQueryOptions } from '@/service/query/user';
import { AuthRole } from '@/lib/auth/tokenStore';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { connectConnectionSocket } from '@/lib/realtime/connectionSocket';
import { DashboardProvider } from './DashboardContext';
import { SidebarLayout } from './SidebarLayout';
import { GUARDIAN_NAV, WARD_NAV } from '@/constants/dashboard';
import { getRealtimeNotification } from '@/lib/dashboard/realtime';
import classNames from 'classnames/bind';
import styles from './DashboardLayout.module.css';

const cx = classNames.bind(styles);
import { WardSettings } from './types';
import {
  DEFAULT_WARD_SETTINGS,
  clampFontSize,
  getValidSosAction,
  WARD_SETTINGS_STORAGE_KEY,
} from '@/constants/wardSettings';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const role: AuthRole = pathname.startsWith('/ward') ? 'WARD' : 'GUARDIAN';
  const [wardSettings, setWardSettings] = useState<WardSettings>(DEFAULT_WARD_SETTINGS);
  const [isWardSettingsLoaded, setIsWardSettingsLoaded] = useState(false);
  const isWard = role === 'WARD';
  const navItems = isWard ? WARD_NAV : GUARDIAN_NAV;
  const rootPath = isWard ? '/ward' : '/guardian';
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const realtimeUserId = profile?.id;

  useWardSettings(isWard, isWardSettingsLoaded, setIsWardSettingsLoaded, setWardSettings, wardSettings);
  useConnectionSocket(realtimeUserId, role);

  const stageStyle = isWard
    ? ({ '--ward-preferred-font-size': `${wardSettings.fontSize}px` } as CSSProperties)
    : undefined;
  return (
    <DashboardProvider
      value={{
        wardSettings,
        updateWardSettings: settings => setWardSettings(current => ({ ...current, ...settings })),
      }}
    >
      <div
        className={cx('stage', {
          guardianTheme: !isWard,
          wardHighContrast: isWard && wardSettings.highContrast,
          wardReadableText: isWard,
        })}
        style={stageStyle}
      >
        <SidebarLayout navItems={navItems} profile={profile} role={role} rootPath={rootPath} />
        <main className={cx('main')}>{children}</main>
      </div>
    </DashboardProvider>
  );
}

function useWardSettings(
  isWard: boolean,
  isLoaded: boolean,
  setIsLoaded: (loaded: boolean) => void,
  setSettings: (settings: WardSettings) => void,
  settings: WardSettings,
) {
  useEffect(() => {
    if (!isWard) return;
    try {
      const rawSettings = window.localStorage.getItem(WARD_SETTINGS_STORAGE_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings) as Partial<WardSettings>;
        setSettings({
          ...DEFAULT_WARD_SETTINGS,
          ...parsed,
          fontSize: clampFontSize(parsed.fontSize),
          sosAction: getValidSosAction(parsed.sosAction),
        });
      }
    } finally {
      setIsLoaded(true);
    }
  }, [isWard, setIsLoaded, setSettings]);

  useEffect(() => {
    if (isWard && isLoaded) window.localStorage.setItem(WARD_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [isWard, isLoaded, settings]);
}

function useConnectionSocket(realtimeUserId: string | undefined, role: AuthRole) {
  useEffect(() => {
    if (!realtimeUserId) return;
    return connectConnectionSocket({
      role,
      userId: realtimeUserId,
      onMessage: payload => {
        window.dispatchEvent(
          new CustomEvent('careai:push', {
            detail: {
              data: { connectionId: payload.connectionId ?? '', type: payload.type },
              notification: getRealtimeNotification(payload),
            },
          }),
        );
      },
    });
  }, [realtimeUserId, role]);
}
