'use client';

import { CSSProperties, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useDashboard } from '@/components/layout/dashboard/DashboardContext';
import { MAX_WARD_FONT_SIZE, MIN_WARD_FONT_SIZE, clampFontSize } from '@/constants/wardSettings';
import {
  userNotificationSettingsQueryOptions,
  useNotificationSettingsMutation,
} from '@/service/query/user';
import type { IUserNotificationSetting, NotificationChannelType } from '@/service/interface/user';

import styles from './WardSettingsContent.module.css';

const NOTIFICATION_CHANNEL_OPTIONS: Array<{
  channelType: NotificationChannelType;
  description: string;
  note: string;
  primaryLabel: string;
}> = [
  {
    channelType: 'FCM',
    description: '푸시 알림',
    note: '현재 실제 연결 알림이 가장 먼저 도착하는 채널입니다.',
    primaryLabel: '기본값',
  },
  {
    channelType: 'SMS',
    description: '문자 알림',
    note: '설정은 저장되지만 현재는 실제 발송에 사용되지 않습니다.',
    primaryLabel: '미지원',
  },
  {
    channelType: 'KAKAO_ALIMTALK',
    description: '카카오 알림톡',
    note: '설정은 저장되지만 현재는 실제 발송에 사용되지 않습니다.',
    primaryLabel: '미지원',
  },
  {
    channelType: 'EMAIL',
    description: '이메일 알림',
    note: '설정은 저장되지만 현재는 실제 발송에 사용되지 않습니다.',
    primaryLabel: '미지원',
  },
];

const SOS_OPTIONS = [
  {
    value: 'call119' as const,
    icon: '🚨',
    label: '119에 바로 연결',
    hint: 'SOS 버튼을 누르면 즉시 119에 전화를 겁니다.',
  },
  {
    value: 'call119AndNotify' as const,
    icon: '📞',
    label: '119 연결 + 보호자 알림',
    hint: '119 통화와 동시에 보호자에게 알림을 보냅니다.',
  },
  {
    value: 'notifyGuardianFirst' as const,
    icon: '💬',
    label: '보호자에게 먼저 알림',
    hint: '보호자에게 먼저 알린 뒤 119 연결 방법을 안내합니다.',
  },
];

export function WardSettingsContent() {
  const { updateWardSettings, wardSettings } = useDashboard();
  const { data: notificationSettingsResponse } = useQuery(userNotificationSettingsQueryOptions);
  const { mutate: updateNotificationSettings, isPending: isUpdatingNotificationSettings } = useNotificationSettingsMutation();
  const [notificationError, setNotificationError] = useState('');
  const [notificationSettingsDraft, setNotificationSettingsDraft] = useState<IUserNotificationSetting[] | null>(null);

  const fontProgress = ((wardSettings.fontSize - MIN_WARD_FONT_SIZE) / (MAX_WARD_FONT_SIZE - MIN_WARD_FONT_SIZE)) * 100;
  const rangeStyle = { '--settings-range-progress': `${fontProgress}%` } as CSSProperties;
  const querySettings = notificationSettingsResponse?.data?.settings ?? [];
  const notificationSettings = notificationSettingsDraft ?? querySettings;
  const notificationSettingMap = new Map(notificationSettings.map(item => [item.channelType, item.enabled]));

  function handleNotificationToggle(channelType: NotificationChannelType, enabled: boolean) {
    const current = notificationSettingMap.get(channelType);
    if (current === enabled) return;

    const previousSettings = notificationSettings;
    const nextSettings = notificationSettings.map(item => (item.channelType === channelType ? { ...item, enabled } : item));

    setNotificationSettingsDraft(nextSettings);
    setNotificationError('');
    updateNotificationSettings(
      { settings: [{ channelType, enabled }] },
      {
        onError: error => {
          setNotificationSettingsDraft(previousSettings);
          setNotificationError(error instanceof Error && error.message ? error.message : '알림 설정 변경에 실패했습니다.');
        },
        onSuccess: () => {
          setNotificationSettingsDraft(null);
        },
      },
    );
  }

  return (
    <div className={styles.page}>
      {/* 글자 크기 */}
      <section className={styles.card} aria-labelledby="s-font">
        <div className={styles.cardHeader}>
          <span className={styles.cardNum}>1</span>
          <div>
            <h3 className={styles.cardTitle} id="s-font">
              글자 크기
            </h3>
            <p className={styles.cardDesc}>슬라이더를 움직여 화면 글자 크기를 조절합니다.</p>
          </div>
        </div>

        <div className={styles.sliderWrap}>
          <div className={styles.sliderTrack}>
            <span className={styles.sliderLabel}>가</span>
            <input
              type="range"
              className={styles.slider}
              min={MIN_WARD_FONT_SIZE}
              max={MAX_WARD_FONT_SIZE}
              value={wardSettings.fontSize}
              style={rangeStyle}
              aria-label="화면 글자 크기"
              onChange={e => updateWardSettings({ fontSize: clampFontSize(Number(e.target.value)) })}
            />
            <span className={styles.sliderLabel} style={{ fontSize: 22 }}>
              가
            </span>
          </div>

          <div className={styles.preview}>
            <p className={styles.previewSample} style={{ fontSize: wardSettings.fontSize }}>
              글자가 이렇게 보입니다.
            </p>
            <span className={styles.previewSize}>{wardSettings.fontSize}px</span>
          </div>
        </div>
      </section>

      {/* 고대비 */}
      <section className={styles.card} aria-labelledby="s-contrast">
        <div className={styles.cardHeader}>
          <span className={styles.cardNum}>2</span>
          <div>
            <h3 className={styles.cardTitle} id="s-contrast">
              화면 대비
            </h3>
            <p className={styles.cardDesc}>글자와 테두리를 더 진하게 표시합니다.</p>
          </div>
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <span className={styles.toggleLabel}>고대비 켜기</span>
            <span className={styles.toggleHint}>시력이 불편한 경우 켜면 화면이 더 선명해집니다.</span>
          </div>
          <label className={styles.toggle} aria-label="고대비 모드">
            <input
              type="checkbox"
              checked={wardSettings.highContrast}
              onChange={e => updateWardSettings({ highContrast: e.target.checked })}
            />
            <span className={styles.toggleThumb} />
          </label>
        </div>

        <div className={`${styles.contrastPreview} ${wardSettings.highContrast ? styles.contrastPreviewOn : ''}`}>
          {wardSettings.highContrast
            ? '고대비 모드가 켜져 있습니다. 글자가 더 선명하게 보입니다.'
            : '일반 모드입니다. 고대비를 켜면 글자가 더 또렷해집니다.'}
        </div>
      </section>

      {/* SOS 동작 */}
      <section className={styles.card} aria-labelledby="s-sos">
        <div className={styles.cardHeader}>
          <span className={styles.cardNum}>3</span>
          <div>
            <h3 className={styles.cardTitle} id="s-sos">
              SOS 동작 설정
            </h3>
            <p className={styles.cardDesc}>긴급 SOS를 눌렀을 때 어떻게 동작할지 선택합니다.</p>
          </div>
        </div>

        <div className={styles.sosGroup} role="radiogroup" aria-labelledby="s-sos">
          {SOS_OPTIONS.map(opt => {
            const isActive = wardSettings.sosAction === opt.value;
            return (
              <label key={opt.value} className={`${styles.sosCard} ${isActive ? styles.sosCardActive : ''}`}>
                <input
                  type="radio"
                  name="ward-sos"
                  value={opt.value}
                  checked={isActive}
                  onChange={() => updateWardSettings({ sosAction: opt.value })}
                />
                <span className={styles.sosIcon}>{opt.icon}</span>
                <span className={styles.sosText}>
                  <span className={styles.sosCardLabel}>{opt.label}</span>
                  <span className={styles.sosCardHint}>{opt.hint}</span>
                </span>
                <span className={styles.sosCheck} aria-hidden="true" />
              </label>
            );
          })}
        </div>
      </section>

      {/* 연결 알림 채널 */}
      <section className={styles.card} aria-labelledby="s-notification">
        <div className={styles.cardHeader}>
          <span className={styles.cardNum}>4</span>
          <div>
            <h3 className={styles.cardTitle} id="s-notification">
              연결 알림 채널 설정
            </h3>
            <p className={styles.cardDesc}>연결 요청, 수락, 거절, 해제 알림을 채널별로 켜고 끌 수 있습니다.</p>
          </div>
        </div>

        <div className={styles.notificationNote}>
          현재 실제 발송되는 채널은 FCM입니다. SMS, 카카오 알림톡, 이메일은 설정만 저장됩니다. 회원가입이나 비밀번호 재설정
          인증번호 발송은 이 설정과 무관합니다.
        </div>

        {notificationError && <div className={styles.notificationError}>{notificationError}</div>}

        <div className={styles.notificationList}>
          {NOTIFICATION_CHANNEL_OPTIONS.map(option => {
            const enabled = notificationSettingMap.get(option.channelType) ?? (option.channelType === 'FCM');

            return (
              <div key={option.channelType} className={styles.notificationRow}>
                <div className={styles.notificationMeta}>
                  <div className={styles.notificationTitleRow}>
                    <span className={styles.notificationTitle}>{option.description}</span>
                    <span className={styles.notificationBadge}>{option.primaryLabel}</span>
                  </div>
                  <span className={styles.notificationDesc}>{option.note}</span>
                </div>
                <label className={styles.notificationToggle} aria-label={`${option.description} 설정`}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={isUpdatingNotificationSettings}
                    onChange={e => handleNotificationToggle(option.channelType, e.target.checked)}
                  />
                  <span className={styles.notificationToggleThumb} />
                </label>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
