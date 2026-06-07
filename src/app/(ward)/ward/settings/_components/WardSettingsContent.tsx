'use client';

import { CSSProperties, FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { useDashboard } from '@/components/layout/dashboard/DashboardContext';
import { MAX_WARD_FONT_SIZE, MIN_WARD_FONT_SIZE, clampFontSize } from '@/constants/wardSettings';
import { clearAuthTokens } from '@/lib/auth/tokenStore';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { getModalErrorMessage } from '@/lib/dashboard/profile';
import { changeMyPassword } from '@/service/api/user';
import type { NotificationChannelType, IUserPasswordChangeReq } from '@/service/interface/user';
import { myProfileQueryOptions } from '@/service/query/user';
import {
  userNotificationSettingsQueryOptions,
  useNotificationSettingsMutation,
} from '@/service/query/user/notification-settings';

import styles from './WardSettingsContent.module.css';

const cx = classNames.bind(styles);

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

type SettingsTab = 'basic' | 'notifications' | 'security';

export function WardSettingsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { updateWardSettings, wardSettings } = useDashboard();

  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const isKakaoUser = profile?.provider === 'KAKAO';

  const { data: notificationSettings = [], isLoading: isLoadingSettings } = useQuery(userNotificationSettingsQueryOptions);
  const notificationMutation = useNotificationSettingsMutation();

  const [activeTab, setActiveTab] = useState<SettingsTab>('basic');
  const [notificationError, setNotificationError] = useState('');
  const [passwordForm, setPasswordForm] = useState<IUserPasswordChangeReq & { newPasswordConfirm: string }>({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirm: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const passwordMutation = useMutation({
    mutationFn: changeMyPassword,
    onMutate: () => {
      setPasswordError('');
      setPasswordModal(null);
    },
    onSuccess: () => {
      setIsPasswordDialogOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      setPasswordModal({ message: '비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.', type: 'success' });
    },
    onError: error => setPasswordModal({ message: getModalErrorMessage(error, '비밀번호 변경에 실패했습니다.'), type: 'error' }),
  });

  const fontProgress = ((wardSettings.fontSize - MIN_WARD_FONT_SIZE) / (MAX_WARD_FONT_SIZE - MIN_WARD_FONT_SIZE)) * 100;
  const rangeStyle = { '--settings-range-progress': `${fontProgress}%` } as CSSProperties;
  const notificationSettingMap = new Map(notificationSettings.map(item => [item.channelType, item.enabled]));

  function handleNotificationToggle(channelType: NotificationChannelType, enabled: boolean) {
    const current = notificationSettingMap.get(channelType);
    if (current === enabled) return;

    setNotificationError('');
    notificationMutation.mutate(
      { settings: [{ channelType, enabled }] },
      {
        onError: error => {
          setNotificationError(error instanceof Error && error.message ? error.message : '알림 설정 변경에 실패했습니다.');
        },
      },
    );
  }

  const openPasswordDialog = () => {
    if (isKakaoUser || passwordMutation.isPending) return;
    setPasswordError('');
    setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
    setIsPasswordDialogOpen(true);
  };

  const closePasswordDialog = () => {
    if (passwordMutation.isPending) return;
    setIsPasswordDialogOpen(false);
    setPasswordError('');
    setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isKakaoUser) {
      setPasswordError('카카오 가입 계정은 비밀번호를 변경할 수 없습니다.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.newPasswordConfirm) {
      setPasswordError('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    passwordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  return (
    <div className={styles.page}>
      {passwordModal && (
        <CommonModal
          type={passwordModal.type}
          tone={profile?.role === 'GUARDIAN' ? 'guardian' : 'default'}
          title={passwordModal.type === 'success' ? '비밀번호 변경 완료' : '비밀번호 변경 실패'}
          message={passwordModal.message}
          confirmText="확인"
          onClose={() => {
            if (passwordModal.type === 'success') {
              clearAuthTokens();
              queryClient.clear();
              router.replace('/login');
              return;
            }
            setPasswordModal(null);
          }}
        />
      )}

      <div className={cx('tabBar')} role="tablist" aria-label="환경설정 탭">
        <button
          className={cx('tabButton', { tabButtonActive: activeTab === 'basic' })}
          type="button"
          role="tab"
          aria-selected={activeTab === 'basic'}
          onClick={() => setActiveTab('basic')}
        >
          기본 설정
        </button>
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

      {activeTab === 'basic' && (
        <>
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
        </>
      )}

      {activeTab === 'notifications' && (
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

          {isLoadingSettings ? (
            <p className={styles.loadingText}>불러오는 중…</p>
          ) : (
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
                        disabled={notificationMutation.isPending}
                        onChange={e => handleNotificationToggle(option.channelType, e.target.checked)}
                      />
                      <span className={styles.notificationToggleThumb} />
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'security' && (
        <>
          <section className={styles.card} aria-labelledby="s-security">
            <div className={styles.cardHeader}>
              <span className={styles.cardNum}>5</span>
              <div>
                <h3 className={styles.cardTitle} id="s-security">
                  보안
                </h3>
                <p className={styles.cardDesc}>비밀번호 변경은 팝업으로 진행합니다.</p>
              </div>
            </div>
            <div className={styles.securityActionRow}>
              <div className={styles.securityMeta}>
                <span className={styles.securityLabel}>비밀번호 변경</span>
                <span className={styles.securityDesc}>현재 비밀번호와 새 비밀번호를 확인한 뒤 변경할 수 있습니다.</span>
              </div>
              <button className={styles.securityButton} type="button" disabled={isKakaoUser || passwordMutation.isPending} onClick={openPasswordDialog}>
                {passwordMutation.isPending ? '변경 중' : '변경하기'}
              </button>
            </div>
          </section>

          {isPasswordDialogOpen && (
            <div className={styles.passwordOverlay} role="presentation" onClick={closePasswordDialog}>
              <section
                className={styles.passwordDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="password-dialog-title"
                onClick={e => e.stopPropagation()}
              >
                <div className={styles.passwordDialogHeader}>
                  <div>
                    <h3 id="password-dialog-title">비밀번호 변경</h3>
                    <p>현재 비밀번호와 새 비밀번호를 입력한 뒤 변경을 눌러주세요.</p>
                  </div>
                  <button className={styles.passwordDialogClose} type="button" aria-label="닫기" onClick={closePasswordDialog}>
                    ×
                  </button>
                </div>

                <form className={styles.passwordDialogForm} onSubmit={handlePasswordSubmit}>
                  <div className={styles.passwordDialogGrid}>
                    <PasswordField
                      disabled={isKakaoUser}
                      label="현재 비밀번호"
                      value={passwordForm.currentPassword}
                      onChange={value => setPasswordForm(current => ({ ...current, currentPassword: value }))}
                    />
                    <PasswordField
                      disabled={isKakaoUser}
                      label="새 비밀번호"
                      value={passwordForm.newPassword}
                      onChange={value => setPasswordForm(current => ({ ...current, newPassword: value }))}
                    />
                    <PasswordField
                      disabled={isKakaoUser}
                      label="새 비밀번호 확인"
                      value={passwordForm.newPasswordConfirm}
                      onChange={value => setPasswordForm(current => ({ ...current, newPasswordConfirm: value }))}
                    />
                  </div>

                  {passwordError && <p className={styles.passwordError}>{passwordError}</p>}

                  <div className={styles.passwordDialogActions}>
                    <button className={styles.passwordDialogSecondaryButton} type="button" onClick={closePasswordDialog}>
                      취소
                    </button>
                    <button className={styles.passwordDialogPrimaryButton} type="submit" disabled={isKakaoUser || passwordMutation.isPending}>
                      {passwordMutation.isPending ? '변경 중' : '변경'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PasswordField({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className={styles.passwordField}>
      <span>{label}</span>
      <input type="password" disabled={disabled} value={value} onChange={event => onChange(event.target.value)} />
    </label>
  );
}
