'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Tabs } from '@/components/Tabs';
import { AccountDeleteSection } from '@/components/settings/AccountDeleteSection';
import { NotificationSettingsSection } from '@/components/settings/NotificationSettingsSection';
import { PasswordChangeSection } from '@/components/settings/PasswordChangeSection';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { myProfileQueryOptions } from '@/service/query/user';
import styles from './GuardianSettingsContent.module.css';

const cx = classNames.bind(styles);

type SettingsTab = 'notifications' | 'security';

export default function GuardianSettingsContent() {
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const isKakaoUser = profile?.provider === 'KAKAO';

  const [activeTab, setActiveTab] = useState<SettingsTab>('notifications');

  return (
    <div className={cx('page')}>
      <Tabs
        ariaLabel="환경설정 탭"
        items={[
          { value: 'notifications', label: '알림정보' },
          { value: 'security', label: '보안' },
        ]}
        onChange={setActiveTab}
        size="md"
        stretch
        value={activeTab}
      />

      {activeTab === 'notifications' ? (
        <NotificationSettingsSection />
      ) : (
        <>
          <PasswordChangeSection isKakaoUser={isKakaoUser} />
          <AccountDeleteSection isKakaoUser={isKakaoUser} />
        </>
      )}
    </div>
  );
}
