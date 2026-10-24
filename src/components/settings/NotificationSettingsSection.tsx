'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import {
  userNotificationSettingsQueryOptions,
  useNotificationSettingsMutation,
} from '@/service/query/user/notification-settings';
import type { NotificationChannelType } from '@/service/interface/user/user';
import { showToast } from '@/store/toastStore';
import styles from './NotificationSettingsSection.module.css';

const cx = classNames.bind(styles);

// 순서·문구는 디자인 기준이되, 각 채널이 실제로 무엇을 보내는지는 BE 규칙에 맞춘다
// - 푸시: SOS·이상 감지는 꺼도 항상 보낸다(강제 푸시)
// - 문자: 켜면 설정 기반 알림도 문자로 받고, SOS·이상 감지는 푸시가 안 가면 꺼져 있어도 대신 보낸다
// - 알림톡: 이상 감지 알림만(승인 템플릿이 이것뿐)
// - 이메일: 안내성 알림만(SOS·이상 감지는 보내지 않는다)
const CHANNEL_OPTIONS: Array<{
  channelType: NotificationChannelType;
  label: string;
  desc: string;
}> = [
  {
    channelType: 'KAKAO_ALIMTALK',
    label: '카카오톡 알림톡',
    desc: '이상 감지 알림을 카카오톡 메시지로 알려 드려요.',
  },
  {
    channelType: 'FCM',
    label: '푸시 알림',
    desc: '휴대폰 앱 알림으로 바로 알려 드려요. SOS·이상 감지 알림은 꺼 두어도 항상 푸시로 보내요.',
  },
  {
    channelType: 'SMS',
    label: 'SMS 문자',
    desc: '켜 두면 알림을 문자로도 받아요. SOS·이상 감지는 푸시가 안 가면 꺼 두어도 문자로 대신 보내요.',
  },
  {
    channelType: 'EMAIL',
    label: '이메일 알림',
    desc: '연결·문의 답변·복약 확인 같은 안내를 가입한 이메일로 보내 드려요. SOS·이상 감지는 이메일로 보내지 않아요.',
  },
];

const SAVE_ERROR_MESSAGE = '알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';

export function NotificationSettingsSection() {
  const { data: notificationSettings = [], isLoading } = useQuery(userNotificationSettingsQueryOptions);
  const mutation = useNotificationSettingsMutation();

  const enabledMap = new Map(notificationSettings.map(item => [item.channelType, item.enabled]));

  // 화면 반영·실패 시 되돌림은 mutation 훅이 맡는다(onMutate·onError)
  const handleToggle = (channelType: NotificationChannelType, enabled: boolean) => {
    if (mutation.isPending || enabledMap.get(channelType) === enabled) return;
    mutation.mutate(
      { settings: [{ channelType, enabled }] },
      { onError: () => showToast(SAVE_ERROR_MESSAGE, { variant: 'error' }) },
    );
  };

  return (
    <section className={cx('section')}>
      {isLoading ? (
        <p className={cx('loading')}>불러오는 중…</p>
      ) : (
        <div className={cx('list')}>
          {CHANNEL_OPTIONS.map(option => {
            const enabled = enabledMap.get(option.channelType) ?? option.channelType === 'FCM';
            return (
              <div key={option.channelType} className={cx('row')}>
                <div className={cx('meta')}>
                  <div className={cx('titleRow')}>
                    <span className={cx('label')}>{option.label}</span>
                  </div>
                  <span className={cx('desc')}>{option.desc}</span>
                </div>
                <label className={cx('toggle')}>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={option.label}
                    checked={enabled}
                    disabled={mutation.isPending}
                    onChange={e => handleToggle(option.channelType, e.target.checked)}
                  />
                  <span className={cx('toggleThumb')} aria-hidden="true" />
                </label>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
