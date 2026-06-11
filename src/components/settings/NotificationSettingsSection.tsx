'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import {
  userNotificationSettingsQueryOptions,
  useNotificationSettingsMutation,
} from '@/service/query/user/notification-settings';
import type { NotificationChannelType } from '@/service/interface/user';
import styles from './NotificationSettingsSection.module.css';

const cx = classNames.bind(styles);

const CHANNEL_OPTIONS: Array<{
  channelType: NotificationChannelType;
  label: string;
  desc: string;
  badge: string;
}> = [
  {
    channelType: 'FCM',
    label: '앱 푸시 알림',
    desc: '연결 요청, 이상 감지 등 주요 알림을 실시간으로 받습니다.',
    badge: '기본값',
  },
  {
    channelType: 'SMS',
    label: 'SMS 문자',
    desc: '긴급 알림을 문자로 받습니다.',
    badge: '미지원',
  },
  {
    channelType: 'KAKAO_ALIMTALK',
    label: '카카오 알림톡',
    desc: '카카오톡으로 서비스 알림을 받습니다.',
    badge: '미지원',
  },
  {
    channelType: 'EMAIL',
    label: '이메일',
    desc: '공지사항 및 서비스 안내를 이메일로 받습니다.',
    badge: '미지원',
  },
];

export function NotificationSettingsSection() {
  const { data: notificationSettings = [], isLoading } = useQuery(userNotificationSettingsQueryOptions);
  const mutation = useNotificationSettingsMutation();
  const [error, setError] = useState('');

  const enabledMap = new Map(notificationSettings.map(item => [item.channelType, item.enabled]));

  const handleToggle = (channelType: NotificationChannelType, enabled: boolean) => {
    if (enabledMap.get(channelType) === enabled) return;
    setError('');
    mutation.mutate(
      { settings: [{ channelType, enabled }] },
      { onError: err => setError(err instanceof Error && err.message ? err.message : '알림 설정 변경에 실패했습니다.') },
    );
  };

  return (
    <section className={cx('section')}>
      <div className={cx('sectionHead')}>
        <h2 className={cx('sectionTitle')}>알림 채널 설정</h2>
        <p className={cx('sectionDesc')}>받고 싶은 알림 채널을 켜거나 끌 수 있습니다.</p>
      </div>

      {isLoading ? (
        <p className={cx('loading')}>불러오는 중…</p>
      ) : (
        <div className={cx('list')}>
          {error && <div className={cx('errorBanner')}>{error}</div>}
          {CHANNEL_OPTIONS.map(option => {
            const enabled = enabledMap.get(option.channelType) ?? (option.channelType === 'FCM');
            return (
              <div key={option.channelType} className={cx('row')}>
                <div className={cx('meta')}>
                  <div className={cx('titleRow')}>
                    <span className={cx('label')}>{option.label}</span>
                    <span className={cx('badge')}>{option.badge}</span>
                  </div>
                  <span className={cx('desc')}>{option.desc}</span>
                </div>
                <label className={cx('toggle')} aria-label={`${option.label} 설정`}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={mutation.isPending}
                    onChange={e => handleToggle(option.channelType, e.target.checked)}
                  />
                  <span className={cx('toggleThumb')} />
                </label>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
