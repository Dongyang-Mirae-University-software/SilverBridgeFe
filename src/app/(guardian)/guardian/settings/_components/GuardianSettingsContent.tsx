'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { clearAuthTokens } from '@/lib/auth/tokenStore';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { getModalErrorMessage } from '@/lib/dashboard/profile';
import { changeMyPassword, deleteMyAccount } from '@/service/api/user';
import type { NotificationChannelType, IUserDeleteReq, IUserPasswordChangeReq } from '@/service/interface/user';
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
type DeleteStep = 'confirm' | 'input';

export default function GuardianSettingsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const isKakaoUser = profile?.provider === 'KAKAO';

  const { data: notificationSettings = [], isLoading: isLoadingSettings } = useQuery(userNotificationSettingsQueryOptions);
  const notificationMutation = useNotificationSettingsMutation();

  const [activeTab, setActiveTab] = useState<SettingsTab>('notifications');
  const [notificationError, setNotificationError] = useState('');
  const [passwordForm, setPasswordForm] = useState<IUserPasswordChangeReq & { newPasswordConfirm: string }>({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirm: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const [deleteStep, setDeleteStep] = useState<DeleteStep | null>(null);
  const [deleteValue, setDeleteValue] = useState('');
  const [deleteError, setDeleteError] = useState('');

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

  const deleteMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      clearAuthTokens();
      queryClient.clear();
      router.replace('/login');
    },
    onError: (error: Error) => setDeleteError(error.message || '회원 탈퇴에 실패했습니다.'),
  });

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

  const openConfirm = () => setDeleteStep('confirm');

  const proceedToInput = () => {
    setDeleteStep('input');
    setDeleteValue('');
    setDeleteError('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeDeleteModal = () => {
    setDeleteStep(null);
    setDeleteValue('');
    setDeleteError('');
  };

  const handleDeleteSubmit = () => {
    setDeleteError('');
    if (isKakaoUser) {
      if (deleteValue !== '회원탈퇴') {
        setDeleteError('"회원탈퇴"를 정확히 입력해주세요.');
        return;
      }
      deleteMutation.mutate({ confirmation: deleteValue } satisfies IUserDeleteReq);
      return;
    }

    if (!deleteValue) {
      setDeleteError('비밀번호를 입력해주세요.');
      return;
    }

    deleteMutation.mutate({ password: deleteValue } satisfies IUserDeleteReq);
  };

  return (
    <div className={cx('page')}>
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

      {deleteStep === 'confirm' && (
        <div className={cx('overlay')} onClick={closeDeleteModal}>
          <div className={cx('modal')} onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
            <div className={cx('modalIcon')}>⚠</div>
            <h3 className={cx('modalTitle')}>정말 탈퇴할까요?</h3>
            <p className={cx('modalDesc')}>
              탈퇴 시 모든 데이터가 삭제되며 <strong>복구할 수 없습니다.</strong>
              <br />
              연결된 피보호자와의 관계도 모두 해제됩니다.
            </p>
            <div className={cx('modalActions')}>
              <button className={cx('modalCancel')} type="button" onClick={closeDeleteModal}>
                취소
              </button>
              <button className={cx('modalDanger')} type="button" onClick={proceedToInput}>
                계속하기
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteStep === 'input' && (
        <div className={cx('overlay')} onClick={closeDeleteModal}>
          <div className={cx('modal')} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className={cx('modalTitle')}>탈퇴 확인</h3>
            <p className={cx('modalDesc')}>
              {isKakaoUser ? (
                <>
                  확인을 위해 <strong>회원탈퇴</strong>를 입력해주세요.
                </>
              ) : (
                '확인을 위해 현재 비밀번호를 입력해주세요.'
              )}
            </p>
            <input
              ref={inputRef}
              className={cx('modalInput', { error: !!deleteError })}
              type={isKakaoUser ? 'text' : 'password'}
              placeholder={isKakaoUser ? '회원탈퇴' : '비밀번호'}
              value={deleteValue}
              autoComplete={isKakaoUser ? 'off' : 'current-password'}
              onChange={e => setDeleteValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDeleteSubmit()}
            />
            {deleteError && <p className={cx('modalError')}>{deleteError}</p>}
            <div className={cx('modalActions')}>
              <button className={cx('modalCancel')} type="button" onClick={closeDeleteModal}>
                취소
              </button>
              <button
                className={cx('modalDanger')}
                type="button"
                disabled={deleteMutation.isPending}
                onClick={handleDeleteSubmit}
              >
                {deleteMutation.isPending ? '처리 중…' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          <section className={cx('section')}>
            <div className={cx('sectionHead')}>
              <h2 className={cx('sectionTitle')}>보안 설정</h2>
              <p className={cx('sectionDesc')}>비밀번호 변경은 팝업으로 진행합니다.</p>
            </div>
            <div className={cx('securityActionRow')}>
              <div className={cx('securityMeta')}>
                <span className={cx('securityLabel')}>비밀번호 변경</span>
                <span className={cx('securityDesc')}>현재 비밀번호와 새 비밀번호를 확인한 뒤 변경할 수 있습니다.</span>
              </div>
              <button className={cx('securityButton')} type="button" disabled={isKakaoUser || passwordMutation.isPending} onClick={openPasswordDialog}>
                {passwordMutation.isPending ? '변경 중' : '변경하기'}
              </button>
            </div>
          </section>

          <section className={cx('section', 'dangerSection')}>
            <div className={cx('sectionHead')}>
              <h2 className={cx('sectionTitle', 'dangerTitle')}>계정 탈퇴</h2>
              <p className={cx('sectionDesc')}>
                탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
                <br />
                연결된 피보호자와의 관계도 모두 해제됩니다.
              </p>
            </div>
            <div className={cx('sectionBody')}>
              <button className={cx('deleteButton')} type="button" onClick={openConfirm}>
                회원 탈퇴
              </button>
            </div>
          </section>

          {isPasswordDialogOpen && (
            <div className={cx('passwordOverlay')} role="presentation" onClick={closePasswordDialog}>
              <section
                className={cx('passwordDialog')}
                role="dialog"
                aria-modal="true"
                aria-labelledby="password-dialog-title"
                onClick={e => e.stopPropagation()}
              >
                <div className={cx('passwordDialogHeader')}>
                  <div>
                    <h3 id="password-dialog-title">비밀번호 변경</h3>
                    <p>현재 비밀번호와 새 비밀번호를 입력한 뒤 변경을 눌러주세요.</p>
                  </div>
                  <button className={cx('passwordDialogClose')} type="button" aria-label="닫기" onClick={closePasswordDialog}>
                    ×
                  </button>
                </div>

                <form className={cx('passwordDialogForm')} onSubmit={handlePasswordSubmit}>
                  <div className={cx('passwordDialogGrid')}>
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

                  {passwordError && <p className={cx('passwordError')}>{passwordError}</p>}

                  <div className={cx('passwordDialogActions')}>
                    <button className={cx('passwordDialogSecondaryButton')} type="button" onClick={closePasswordDialog}>
                      취소
                    </button>
                    <button className={cx('passwordDialogPrimaryButton')} type="submit" disabled={isKakaoUser || passwordMutation.isPending}>
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
    <label className={cx('passwordField')}>
      <span>{label}</span>
      <input type="password" disabled={disabled} value={value} onChange={event => onChange(event.target.value)} />
    </label>
  );
}
