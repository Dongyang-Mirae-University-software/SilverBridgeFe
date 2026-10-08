'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { AccountDeleteSection } from '@/components/settings/AccountDeleteSection';
import { PasswordChangeSection } from '@/components/settings/PasswordChangeSection';
import { Icon, type IconName } from '@/components/Icon';
import { useDashboard } from '@/components/layout/dashboard/DashboardContext';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { myProfileQueryOptions } from '@/service/query/user';
import { WardDisplaySettingsSection, WardSosSettingsSection } from './WardBasicSettingsSection';

import styles from './WardSettingsContent.module.css';

type SettingsTab = 'screen' | 'sos' | 'account';

const SETTINGS_TABS: Array<{ icon: IconName; label: string; value: SettingsTab }> = [
  { icon: 'eye', label: '글자 크기', value: 'screen' },
  { icon: 'phone', label: 'SOS 동작', value: 'sos' },
  { icon: 'user', label: '계정 · 보안', value: 'account' },
];

export function WardSettingsContent() {
  const { updateWardSettings, wardSettings } = useDashboard();

  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const isKakaoUser = profile?.provider === 'KAKAO';

  const [activeTab, setActiveTab] = useState<SettingsTab>('screen');

  return (
    <div className={styles.page}>
      <div className={styles.tabList} role="tablist" aria-label="환경설정 탭">
        {SETTINGS_TABS.map(tab => {
          const isActive = activeTab === tab.value;

          return (
            <button
              key={tab.value}
              className={`${styles.tabButton} ${isActive ? styles.activeTab : ''}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.value)}
            >
              <Icon name={tab.icon} size={24} decorative />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'screen' && (
        <WardDisplaySettingsSection updateWardSettings={updateWardSettings} wardSettings={wardSettings} />
      )}

      {activeTab === 'sos' && <WardSosSettingsSection updateWardSettings={updateWardSettings} wardSettings={wardSettings} />}

      {activeTab === 'account' && (
        <section className={styles.accountCard}>
          <PasswordChangeSection isKakaoUser={isKakaoUser} variant="ward" />
          <AccountDeleteSection isKakaoUser={isKakaoUser} variant="ward" />
        </section>
      )}
    </div>
  );
}
