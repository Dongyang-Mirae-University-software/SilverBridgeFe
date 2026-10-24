'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { clearAuthTokens } from '@/lib/auth/tokenStore';
import { deleteMyAccount } from '@/service/api/user/user';
import type { IUserDeleteReq } from '@/service/interface/user/user';
import styles from './AccountDeleteSection.module.css';

const cx = classNames.bind(styles);

type DeleteStep = 'confirm' | 'input';

// 카카오 가입 계정의 본인 확인 문구 - BE가 "탈퇴"·"회원탈퇴" 둘 다 받는다(안내는 짧은 "탈퇴")
const KAKAO_CONFIRMATIONS = ['탈퇴', '회원탈퇴'];

// 피보호자 화면은 해요체·큰 글씨, 탈퇴하면 보호자 연결도 끊긴다는 점을 함께 알린다
const COPY = {
  default: {
    rowDesc: '탈퇴 시 모든 데이터가 즉시 삭제되며 복구되지 않습니다',
    confirmTitle: '정말 탈퇴하시겠습니까?',
    confirmDesc: (
      <>
        탈퇴 즉시 계정과 모든 데이터가 삭제되며,
        <br />
        <strong>복구할 수 없습니다.</strong>
      </>
    ),
    passwordGuide: '확인을 위해 현재 비밀번호를 입력해 주세요.',
    kakaoError: '"탈퇴"를 정확히 입력해 주세요.',
    passwordError: '비밀번호를 입력해 주세요.',
  },
  ward: {
    rowDesc: '탈퇴하면 모든 정보가 바로 지워지고 되돌릴 수 없어요',
    confirmTitle: '정말 탈퇴하시겠어요?',
    confirmDesc: (
      <>
        탈퇴하면 계정과 모든 정보가 바로 지워지고,
        <br />
        보호자와의 연결도 끊어져요. <strong>되돌릴 수 없어요.</strong>
      </>
    ),
    passwordGuide: '확인을 위해 지금 쓰는 비밀번호를 입력해 주세요.',
    kakaoError: '"탈퇴"를 정확히 입력해 주세요.',
    passwordError: '비밀번호를 입력해 주세요.',
  },
};

export function AccountDeleteSection({ isKakaoUser, variant = 'default' }: { isKakaoUser: boolean; variant?: 'default' | 'ward' }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = COPY[variant];
  const isWard = variant === 'ward';

  const [deleteStep, setDeleteStep] = useState<DeleteStep | null>(null);
  const [deleteValue, setDeleteValue] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const deleteMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      clearAuthTokens();
      queryClient.clear();
      router.replace('/login');
    },
    onError: (error: Error) => setDeleteError(error.message || '회원 탈퇴에 실패했습니다.'),
  });

  const openConfirm = () => setDeleteStep('confirm');

  const proceedToInput = () => {
    setDeleteStep('input');
    setDeleteValue('');
    setDeleteError('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeDeleteModal = () => {
    if (deleteMutation.isPending) return;
    setDeleteStep(null);
    setDeleteValue('');
    setDeleteError('');
  };

  const handleDeleteSubmit = () => {
    if (deleteMutation.isPending) return;
    setDeleteError('');
    if (isKakaoUser) {
      const confirmation = deleteValue.trim();
      if (!KAKAO_CONFIRMATIONS.includes(confirmation)) {
        setDeleteError(copy.kakaoError);
        return;
      }
      deleteMutation.mutate({ confirmation } satisfies IUserDeleteReq);
      return;
    }
    if (!deleteValue) {
      setDeleteError(copy.passwordError);
      return;
    }
    deleteMutation.mutate({ password: deleteValue } satisfies IUserDeleteReq);
  };

  return (
    <>
      <div className={cx('row', { ward: isWard })}>
        <div className={cx('meta')}>
          <span className={cx('label')}>회원 탈퇴</span>
          <span className={cx('desc')}>{copy.rowDesc}</span>
        </div>
        <button className={cx('deleteButton')} type="button" onClick={openConfirm}>
          탈퇴
        </button>
      </div>

      {deleteStep === 'confirm' && (
        <div className={cx('overlay')} onClick={closeDeleteModal}>
          <div
            className={cx('modal', { ward: isWard })}
            onClick={e => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="account-delete-confirm-title"
          >
            <div className={cx('modalIcon')}>
              <Icon name="warning" size={28} />
            </div>
            <h3 className={cx('modalTitle')} id="account-delete-confirm-title">
              {copy.confirmTitle}
            </h3>
            <p className={cx('modalDesc')}>{copy.confirmDesc}</p>
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
          <div
            className={cx('modal', { ward: isWard })}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-delete-input-title"
          >
            <h3 className={cx('modalTitle')} id="account-delete-input-title">
              탈퇴 확인
            </h3>
            <p className={cx('modalDesc')}>
              {isKakaoUser ? (
                <>
                  확인을 위해 <strong>탈퇴</strong>를 입력해 주세요.
                </>
              ) : (
                copy.passwordGuide
              )}
            </p>
            <input
              ref={inputRef}
              className={cx('modalInput', { error: !!deleteError })}
              type={isKakaoUser ? 'text' : 'password'}
              aria-label={isKakaoUser ? '탈퇴 확인 문구' : '비밀번호'}
              placeholder={isKakaoUser ? '탈퇴' : '비밀번호'}
              value={deleteValue}
              autoComplete={isKakaoUser ? 'off' : 'current-password'}
              disabled={deleteMutation.isPending}
              onChange={e => setDeleteValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDeleteSubmit()}
            />
            {deleteError && <p className={cx('modalError')}>{deleteError}</p>}
            <div className={cx('modalActions')}>
              <button
                className={cx('modalCancel')}
                type="button"
                disabled={deleteMutation.isPending}
                onClick={closeDeleteModal}
              >
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
    </>
  );
}
