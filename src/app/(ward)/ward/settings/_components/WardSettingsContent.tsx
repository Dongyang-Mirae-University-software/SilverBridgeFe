'use client';

import { CSSProperties, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { AccountDeleteSection } from '@/components/settings/AccountDeleteSection';
import { NotificationSettingsSection } from '@/components/settings/NotificationSettingsSection';
import { PasswordChangeSection } from '@/components/settings/PasswordChangeSection';
import { Icon } from '@/components/Icon';
import { Tabs } from '@/components/Tabs';
import { useDashboard } from '@/components/layout/dashboard/DashboardContext';
import { MAX_WARD_FONT_SIZE, MIN_WARD_FONT_SIZE, clampFontSize } from '@/constants/wardSettings';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { myProfileQueryOptions } from '@/service/query/user';

import styles from './WardSettingsContent.module.css';

const cx = classNames.bind(styles);

const SOS_OPTIONS = [
  {
    value: 'call119' as const,
    icon: 'alert' as const,
    label: '119에 바로 연결',
    hint: 'SOS 버튼을 누르면 즉시 119에 전화를 겁니다.',
  },
  {
    value: 'call119AndNotify' as const,
    icon: 'phone' as const,
    label: '119 연결 + 보호자 알림',
    hint: '119 통화와 동시에 보호자에게 알림을 보냅니다.',
  },
  {
    value: 'notifyGuardianFirst' as const,
    icon: 'messageCircle' as const,
    label: '보호자에게 먼저 알림',
    hint: '보호자에게 먼저 알린 뒤 119 연결 방법을 안내합니다.',
  },
];

type SettingsTab = 'basic' | 'notifications' | 'security';

export function WardSettingsContent() {
  const { updateWardSettings, wardSettings } = useDashboard();

  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const isKakaoUser = profile?.provider === 'KAKAO';

  const [activeTab, setActiveTab] = useState<SettingsTab>('basic');

  const fontProgress = ((wardSettings.fontSize - MIN_WARD_FONT_SIZE) / (MAX_WARD_FONT_SIZE - MIN_WARD_FONT_SIZE)) * 100;
  const rangeStyle = { '--settings-range-progress': `${fontProgress}%` } as CSSProperties;

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
        <>
          <section className={styles.card} aria-labelledby="s-font">
            <div className={styles.cardHeader}>
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

          <section className={styles.card} aria-labelledby="s-contrast">
            <div className={styles.cardHeader}>
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

          <section className={styles.card} aria-labelledby="s-sos">
            <div className={styles.cardHeader}>
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
                    <Icon name={opt.icon} size={24} className={styles.sosIcon} />
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
        </>
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
