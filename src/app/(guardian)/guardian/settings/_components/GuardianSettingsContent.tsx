'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { AccountDeleteSection } from '@/components/settings/AccountDeleteSection';
import { NotificationSettingsSection } from '@/components/settings/NotificationSettingsSection';
import { PasswordChangeSection } from '@/components/settings/PasswordChangeSection';
import { getUserProfileData } from '@/lib/auth/userProfile';
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
      <div className={cx('tabBar')} role="tablist" aria-label="환경설정 탭">
        <button
          className={cx('tabButton', { tabButtonActive: activeTab === 'notifications' })}
          type="button"
          role="tab"
          aria-selected={activeTab === 'notifications'}
          onClick={() => setActiveTab('notifications')}
        >
          알림정보
        </button>
        <button
          className={cx('tabButton', { tabButtonActive: activeTab === 'security' })}
          type="button"
          role="tab"
          aria-selected={activeTab === 'security'}
          onClick={() => setActiveTab('security')}
        >
          보안
        </button>
      </div>

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
