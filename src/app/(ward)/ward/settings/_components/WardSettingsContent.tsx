'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { AccountDeleteSection } from '@/components/settings/AccountDeleteSection';
import { NotificationSettingsSection } from '@/components/settings/NotificationSettingsSection';
import { PasswordChangeSection } from '@/components/settings/PasswordChangeSection';
import { Tabs } from '@/components/Tabs';
import { useDashboard } from '@/components/layout/dashboard/DashboardContext';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { myProfileQueryOptions } from '@/service/query/user';
import { WardBasicSettingsSection } from './WardBasicSettingsSection';

import styles from './WardSettingsContent.module.css';

type SettingsTab = 'basic' | 'notifications' | 'security';

export function WardSettingsContent() {
  const { updateWardSettings, wardSettings } = useDashboard();

  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const isKakaoUser = profile?.provider === 'KAKAO';

  const [activeTab, setActiveTab] = useState<SettingsTab>('basic');

  return (
    <div className={styles.page}>
      <Tabs
        ariaLabel="환경설정 탭"
        items={[
          { value: 'basic', label: '기본 설정' },
          { value: 'notifications', label: '알림정보' },
          { value: 'security', label: '보안' },
        ]}
        onChange={setActiveTab}
        size="md"
        stretch
        value={activeTab}
      />

      {activeTab === 'basic' && (
        <WardBasicSettingsSection updateWardSettings={updateWardSettings} wardSettings={wardSettings} />
      )}

      {activeTab === 'notifications' && <NotificationSettingsSection />}

      {activeTab === 'security' && (
        <>
          <PasswordChangeSection isKakaoUser={isKakaoUser} />
          <AccountDeleteSection isKakaoUser={isKakaoUser} />
        </>
      )}
    </div>
  );
}
