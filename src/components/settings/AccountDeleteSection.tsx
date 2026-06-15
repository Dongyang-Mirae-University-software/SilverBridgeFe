'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { clearAuthTokens } from '@/lib/auth/tokenStore';
import { deleteMyAccount } from '@/service/api/user';
import type { IUserDeleteReq } from '@/service/interface/user';
import styles from './AccountDeleteSection.module.css';

const cx = classNames.bind(styles);

type DeleteStep = 'confirm' | 'input';

export function AccountDeleteSection({ isKakaoUser }: { isKakaoUser: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

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
    <>
      <section className={cx('dangerSection')}>
        <div className={cx('sectionHead')}>
          <h2 className={cx('sectionTitle')}>계정 탈퇴</h2>
          <p className={cx('sectionDesc')}>탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.</p>
        </div>
        <div className={cx('sectionBody')}>
          <button className={cx('deleteButton')} type="button" onClick={openConfirm}>
            회원 탈퇴
          </button>
        </div>
      </section>

      {deleteStep === 'confirm' && (
        <div className={cx('overlay')} onClick={closeDeleteModal}>
          <div className={cx('modal')} onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
            <div className={cx('modalIcon')}>
              <Icon name="warning" size={28} />
            </div>
            <h3 className={cx('modalTitle')}>정말 탈퇴할까요?</h3>
            <p className={cx('modalDesc')}>
              탈퇴 시 모든 데이터가 삭제되며 <strong>복구할 수 없습니다.</strong>
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
