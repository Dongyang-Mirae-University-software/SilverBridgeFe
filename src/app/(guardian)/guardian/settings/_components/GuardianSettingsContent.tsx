'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { deleteMyAccount } from '@/service/api/user';
import { clearAuthTokens } from '@/lib/auth/tokenStore';
import { myProfileQueryOptions } from '@/service/query/user';
import { getUserProfileData } from '@/lib/auth/userProfile';
import {
  userNotificationSettingsQueryOptions,
  useNotificationSettingsMutation,
} from '@/service/query/user/notification-settings';
import type { NotificationChannelType } from '@/service/interface/user';
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

export default function GuardianSettingsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const isKakaoUser = profile?.provider === 'KAKAO';

  const { data: notificationSettings = [], isLoading: isLoadingSettings } = useQuery(userNotificationSettingsQueryOptions);
  const notificationMutation = useNotificationSettingsMutation();

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      clearAuthTokens();
      queryClient.clear();
      router.replace('/login');
    },
    onError: (error: Error) => setDeleteError(error.message || '회원 탈퇴에 실패했습니다.'),
  });

  const handleToggle = (channelType: NotificationChannelType, enabled: boolean) => {
    notificationMutation.mutate({
      settings: [{ channelType, enabled }],
    });
  };

  const handleDeleteSubmit = () => {
    setDeleteError('');
    if (!isKakaoUser && !deletePassword) {
      setDeleteError('비밀번호를 입력해주세요.');
      return;
    }
    if (isKakaoUser && deleteConfirm !== '회원탈퇴') {
      setDeleteError('"회원탈퇴"를 정확히 입력해주세요.');
      return;
    }
    deleteMutation.mutate(
      isKakaoUser ? { confirmation: deleteConfirm } : { password: deletePassword },
    );
  };

  return (
    <div className={cx('page')}>
      {showDeleteModal && (
        <CommonModal
          type="error"
          tone="guardian"
          title="정말 탈퇴할까요?"
          message="탈퇴 후에는 계정을 복구할 수 없습니다. 신중하게 확인해주세요."
          confirmText="취소"
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {/* 알림 설정 */}
      <section className={cx('section')}>
        <div className={cx('sectionHead')}>
          <h2 className={cx('sectionTitle')}>알림 설정</h2>
          <p className={cx('sectionDesc')}>받고 싶은 알림 채널을 선택하세요.</p>
        </div>

        {isLoadingSettings ? (
          <p className={cx('loadingText')}>불러오는 중…</p>
        ) : (
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
                  onClick={() => handleToggle(channelType, !enabled)}
                >
                  <span className={cx('toggleThumb')} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 계정 탈퇴 */}
      <section className={cx('section', 'dangerSection')}>
        <div className={cx('sectionHead')}>
          <h2 className={cx('sectionTitle', 'dangerTitle')}>계정 탈퇴</h2>
          <p className={cx('sectionDesc')}>
            탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
            연결된 피보호자와의 관계도 모두 해제됩니다.
          </p>
        </div>

        <div className={cx('deleteForm')}>
          {isKakaoUser ? (
            <label className={cx('fieldLabel')}>
              확인을 위해 <strong>회원탈퇴</strong>를 입력하세요.
              <input
                className={cx('input')}
                type="text"
                placeholder="회원탈퇴"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
              />
            </label>
          ) : (
            <label className={cx('fieldLabel')}>
              확인을 위해 현재 비밀번호를 입력하세요.
              <input
                className={cx('input')}
                type="password"
                placeholder="비밀번호"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
          )}

          {deleteError && <p className={cx('errorText')}>{deleteError}</p>}

          <button
            className={cx('deleteButton')}
            type="button"
            disabled={deleteMutation.isPending}
            onClick={handleDeleteSubmit}
          >
            {deleteMutation.isPending ? '처리 중…' : '회원 탈퇴'}
          </button>
        </div>
      </section>
    </div>
  );
}
