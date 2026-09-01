'use client';

import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { DashboardProvider } from '@/components/layout/dashboard/DashboardContext';
import { SidebarLayout } from '@/components/layout/dashboard/SidebarLayout';
import { WardSettings } from '@/components/layout/dashboard/types';
import { WARD_NAV } from '@/constants/dashboard';
import {
  DEFAULT_WARD_SETTINGS,
  WARD_SETTINGS_STORAGE_KEY,
  clampFontSize,
  getValidSosAction,
} from '@/constants/wardSettings';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { getRealtimeNotification } from '@/lib/dashboard/realtime';
import { connectConnectionSocket } from '@/lib/realtime/connectionSocket';
import { myProfileQueryOptions } from '@/service/query/user';
import styles from './WardLayout.module.css';

const cx = classNames.bind(styles);

const role = 'WARD' as const;
const rootPath = '/ward';

export function WardLayout({ children }: { children: ReactNode }) {
  const [wardSettings, setWardSettings] = useState<WardSettings>(DEFAULT_WARD_SETTINGS);
  const [isWardSettingsLoaded, setIsWardSettingsLoaded] = useState(false);
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const realtimeUserId = profile?.id;

  useWardSettings(isWardSettingsLoaded, setIsWardSettingsLoaded, setWardSettings, wardSettings);
  useWardConnectionSocket(realtimeUserId);

  const stageStyle = { '--ward-preferred-font-size': `${wardSettings.fontSize}px` } as CSSProperties;

  return (
    <DashboardProvider
      value={{
        wardSettings,
        updateWardSettings: settings => setWardSettings(current => ({ ...current, ...settings })),
      }}
    >
      <div
        className={cx('stage', { wardHighContrast: wardSettings.highContrast, wardReadableText: true })}
        style={stageStyle}
      >
        <SidebarLayout navItems={WARD_NAV} profile={profile} role={role} rootPath={rootPath} />
        <main className={cx('main')}>{children}</main>
      </div>
    </DashboardProvider>
  );
}

function useWardSettings(
  isLoaded: boolean,
  setIsLoaded: (loaded: boolean) => void,
  setSettings: (settings: WardSettings) => void,
  settings: WardSettings,
) {
  useEffect(() => {
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
  }, [setIsLoaded, setSettings]);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem(WARD_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [isLoaded, settings]);
}

function useWardConnectionSocket(realtimeUserId: string | undefined) {
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
  }, [realtimeUserId]);
}
