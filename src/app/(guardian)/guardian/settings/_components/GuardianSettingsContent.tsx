'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { AccountDeleteSection } from '@/components/settings/AccountDeleteSection';
import { PasswordChangeSection } from '@/components/settings/PasswordChangeSection';
import { getUserProfileData } from '@/lib/auth/userProfile';
import type { NotificationChannelType } from '@/service/interface/user';
import { myProfileQueryOptions } from '@/service/query/user';
import {
  userNotificationSettingsQueryOptions,
  useNotificationSettingsMutation,
} from '@/service/query/user/notification-settings';
import styles from './GuardianSettingsContent.module.css';

const cx = classNames.bind(styles);

const CHANNEL_LABELS: Record<NotificationChannelType, string> = {
  FCM: '앱 푸시 알림',
  SMS: 'SMS 문자',
  KAKAO_ALIMTALK: '카카오 알림톡',
  EMAIL: '이메일',
};

const CHANNEL_DESC: Record<NotificationChannelType, string> = {
  FCM: '연결 요청, 이상 감지 등 주요 알림을 실시간으로 받습니다.',
  SMS: '긴급 알림을 문자로 받습니다.',
  KAKAO_ALIMTALK: '카카오톡으로 서비스 알림을 받습니다.',
  EMAIL: '공지사항 및 서비스 안내를 이메일로 받습니다.',
};

type SettingsTab = 'notifications' | 'security';

export default function GuardianSettingsContent() {
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const isKakaoUser = profile?.provider === 'KAKAO';

  const { data: notificationSettings = [], isLoading: isLoadingSettings } = useQuery(userNotificationSettingsQueryOptions);
  const notificationMutation = useNotificationSettingsMutation();

  const [activeTab, setActiveTab] = useState<SettingsTab>('notifications');
  const [notificationError, setNotificationError] = useState('');

  const handleNotificationToggle = (channelType: NotificationChannelType, enabled: boolean) => {
    setNotificationError('');
    notificationMutation.mutate(
      { settings: [{ channelType, enabled }] },
      {
        onError: error => {
          setNotificationError(error instanceof Error && error.message ? error.message : '알림 설정 변경에 실패했습니다.');
        },
      },
    );
  };

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
        <section className={cx('section')}>
          <div className={cx('sectionHead')}>
            <h2 className={cx('sectionTitle')}>알림 설정</h2>
            <p className={cx('sectionDesc')}>받고 싶은 알림 채널을 선택하세요.</p>
          </div>

          {isLoadingSettings ? (
            <p className={cx('loadingText')}>불러오는 중…</p>
          ) : (
            <>
              {notificationError && <div className={cx('notificationError')}>{notificationError}</div>}
              <ul className={cx('toggleList')}>
                {notificationSettings.map(({ channelType, enabled }) => (
                  <li key={channelType} className={cx('toggleItem')}>
                    <div>
                      <span className={cx('toggleLabel')}>{CHANNEL_LABELS[channelType]}</span>
                      <span className={cx('toggleDesc')}>{CHANNEL_DESC[channelType]}</span>
                    </div>
                    <button
                      className={cx('toggle', { on: enabled })}
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      disabled={notificationMutation.isPending}
                      onClick={() => handleNotificationToggle(channelType, !enabled)}
                    >
                      <span className={cx('toggleThumb')} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : (
        <>
          <PasswordChangeSection isKakaoUser={isKakaoUser} />
          <AccountDeleteSection isKakaoUser={isKakaoUser} />
        </>
      )}
    </div>
  );
}
