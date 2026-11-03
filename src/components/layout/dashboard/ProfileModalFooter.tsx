'use client';

import { useLogoutMutation } from '@/service/query/auth';
import { CommonModal } from '@/components/CommonModal';
import useModalStore from '@/store/modalStore';
import classNames from 'classnames/bind';
import styles from './ProfileModalFooter.module.css';

const cx = classNames.bind(styles);

interface Props {
  actionLabel: string;
  isEditing?: boolean;
  onAction?: () => void;
  onClose: () => void;
}

export function ProfileModalFooter({ actionLabel, isEditing = false, onAction, onClose }: Props) {
  const { mutate: logout, isPending } = useLogoutMutation();
  const { openModal, onCloseModal } = useModalStore(state => ({ openModal: state.openModal, onCloseModal: state.onCloseModal }));

  const requestLogout = () => {
    if (isPending) return;
    openModal(
      <CommonModal
        type="warning"
        tone="guardian"
        title="로그아웃 확인"
        message="정말 로그아웃할까요?"
        primaryButton={{ text: '로그아웃', disabled: isPending, onClick: () => logout() }}
        secondaryButton={{ text: '취소', onClick: onCloseModal }}
        onClose={onCloseModal}
      />,
    );
  };

  return (
    <>
      <button className={cx('logoutButton')} type="button" disabled={isPending} onClick={requestLogout}>{isPending ? '로그아웃 중...' : '로그아웃'}</button>
      {onAction ? <button className={cx('actionButton')} type="button" onClick={onAction}>{isEditing ? '수정 취소' : actionLabel}</button> : <button className={cx('actionButton')} type="button" onClick={onClose}>닫기</button>}
    </>
  );
}
