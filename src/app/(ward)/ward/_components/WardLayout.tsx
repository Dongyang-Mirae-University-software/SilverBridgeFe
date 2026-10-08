'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { getUserProfileData } from '@/utils/auth/userProfile';
import { getRealtimeNotification } from '@/utils/dashboard/realtime';
import { connectConnectionSocket } from '@/lib/realtime/connectionSocket';
import { myProfileQueryOptions } from '@/service/query/user';
import { applyMedicationTakenToWardCache } from '@/service/query/ward/medication';
import { wardSosSettingQueryOptions } from '@/service/query/ward/sosSetting';
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
  useWardSosSettingSync(setWardSettings);
  useWardConnectionSocket(realtimeUserId);
  useWardRootFontSize(wardSettings.fontSize);

  return (
    <DashboardProvider
      value={{
        wardSettings,
        updateWardSettings: settings => setWardSettings(current => ({ ...current, ...settings })),
      }}
    >
      <div className={cx('stage', { wardHighContrast: wardSettings.highContrast, wardReadableText: true })}>
        <SidebarLayout navItems={WARD_NAV} profile={profile} role={role} rootPath={rootPath} />
        <main className={cx('main')}>{children}</main>
      </div>
    </DashboardProvider>
  );
}

function useWardRootFontSize(fontSize: number) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${fontSize}px`;
    return () => {
      root.style.fontSize = '';
    };
  }, [fontSize]);
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

// sosAction은 계정 단위로 동기화된다 — 기기별 localStorage 값은 첫 로딩까지만
// 임시로 쓰고, 서버 응답이 오면 한 번 덮어쓴다(이후 변경은 PUT 성공 시 로컬에 바로 반영)
function useWardSosSettingSync(setSettings: (updater: (current: WardSettings) => WardSettings) => void) {
  const { data } = useQuery(wardSosSettingQueryOptions);
  const didSyncRef = useRef(false);

  useEffect(() => {
    if (didSyncRef.current || !data) return;
    didSyncRef.current = true;
    setSettings(current => ({ ...current, sosAction: getValidSosAction(data.sosAction) }));
  }, [data, setSettings]);
}

function useWardConnectionSocket(realtimeUserId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!realtimeUserId) return;
    return connectConnectionSocket({
      role,
      userId: realtimeUserId,
      onMessage: payload => {
        // 다른 기기·탭에서 체크한 경우의 동기화 — 알림 없이 조용히 갱신
        if (payload.type === 'MEDICATION_TAKEN') {
          applyMedicationTakenToWardCache(queryClient, payload);
          return;
        }

        window.dispatchEvent(
          new CustomEvent('careai:push', {
            detail: {
              data: {
                connectionId: payload.connectionId ?? '',
                type: payload.type,
                wardId: payload.wardId ?? '',
                wardName: payload.wardName ?? '',
                location: payload.location ?? '',
                detectedType: payload.detectedType ?? '',
                detectedTypeLabel: payload.detectedTypeLabel ?? '',
                sessionId: payload.sessionId ?? '',
                anomalyEventId: payload.anomalyEventId ?? '',
                incidentId: payload.incidentId ?? '',
                detectedAt: payload.detectedAt ?? '',
              },
              notification: getRealtimeNotification(payload, role),
            },
          }),
        );
      },
    });
  }, [queryClient, realtimeUserId]);
}
