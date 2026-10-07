'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Tabs } from '@/components/Tabs';
import { AccountDeleteSection } from '@/components/settings/AccountDeleteSection';
import { AlertTypeSettingsSection } from '@/components/settings/AlertTypeSettingsSection';
import { NotificationSettingsSection } from '@/components/settings/NotificationSettingsSection';
import { PasswordChangeSection } from '@/components/settings/PasswordChangeSection';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { myProfileQueryOptions } from '@/service/query/user';
import styles from './GuardianSettingsContent.module.css';

const cx = classNames.bind(styles);

type SettingsTab = 'alert' | 'channel' | 'account';

export default function GuardianSettingsContent() {
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const isKakaoUser = profile?.provider === 'KAKAO';

  const [activeTab, setActiveTab] = useState<SettingsTab>('alert');

  return (
    <div className={cx('page')}>
      <Tabs
        ariaLabel="환경설정 탭"
        items={[
          { value: 'alert', label: '알림 종류' },
          { value: 'channel', label: '알림 방법' },
          { value: 'account', label: '계정·보안' },
        ]}
        onChange={setActiveTab}
        size="md"
        value={activeTab}
        variant="underline"
      />

      {activeTab === 'alert' && <AlertTypeSettingsSection />}

      {activeTab === 'channel' && <NotificationSettingsSection />}

      {activeTab === 'account' && (
        <>
          <PasswordChangeSection isKakaoUser={isKakaoUser} />
          <AccountDeleteSection isKakaoUser={isKakaoUser} />
        </>
      )}
    </div>
  );
}
