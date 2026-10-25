'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { clearAuthTokens } from '@/lib/auth/tokenStore';
import { getModalErrorMessage } from '@/utils/dashboard/profile';
import { changeMyPassword } from '@/service/api/user/user';
import type { IUserPasswordChangeReq } from '@/service/interface/user/user';
import styles from './PasswordChangeSection.module.css';

const cx = classNames.bind(styles);

// 피보호자 화면은 해요체로 쓴다(디자인 기준)
const COPY = {
  default: {
    desc: '로그인할 때 쓰는 비밀번호를 바꿉니다',
    kakaoDesc: '카카오로 가입한 계정은 비밀번호가 없어 바꿀 수 없습니다.',
    confirmPlaceholder: '새 비밀번호 확인',
    shortError: '새 비밀번호는 8자 이상이어야 합니다.',
    mismatchError: '새 비밀번호가 서로 다릅니다.',
  },
  ward: {
    desc: '로그인할 때 쓰는 비밀번호를 바꿔요',
    kakaoDesc: '카카오로 가입한 계정은 비밀번호가 없어 바꿀 수 없어요.',
    confirmPlaceholder: '새 비밀번호 한 번 더',
    shortError: '새 비밀번호는 8자 이상이어야 해요.',
    mismatchError: '새 비밀번호가 서로 달라요.',
  },
};

export function PasswordChangeSection({
  isKakaoUser,
  isAccountReady = true,
  variant = 'default',
}: {
  isKakaoUser: boolean;
  // 프로필을 받아 카카오 계정 여부를 확인했는지 - 확인 전에는 버튼을 막는다
  isAccountReady?: boolean;
  variant?: 'default' | 'ward';
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const copy = COPY[variant];

  const [form, setForm] = useState<IUserPasswordChangeReq & { newPasswordConfirm: string }>({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirm: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [resultModal, setResultModal] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const mutation = useMutation({
    mutationFn: changeMyPassword,
    onMutate: () => setResultModal(null),
    onSuccess: () => {
      setIsEditing(false);
      setForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      setResultModal({ message: '비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.', type: 'success' });
    },
    onError: error => setResultModal({ message: getModalErrorMessage(error, '비밀번호 변경에 실패했습니다.'), type: 'error' }),
  });

  const openEdit = () => {
    if (isKakaoUser || mutation.isPending) return;
    setForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
    setIsEditing(true);
  };

  const closeEdit = () => {
    if (mutation.isPending) return;
    setIsEditing(false);
    setForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isKakaoUser) return;
    if (!ok) return;
    mutation.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  };

  const short = form.newPassword.length > 0 && form.newPassword.length < 8;
  const mismatch = form.newPasswordConfirm.length > 0 && form.newPasswordConfirm !== form.newPassword;
  const ok = Boolean(form.currentPassword) && form.newPassword.length >= 8 && form.newPasswordConfirm === form.newPassword;

  return (
    <>
      {resultModal && (
        <CommonModal
          type={resultModal.type}
          title={resultModal.type === 'success' ? '비밀번호 변경 완료' : '비밀번호 변경 실패'}
          message={resultModal.message}
          primaryButton={{
            text: '확인',
            onClick: () => {
              if (resultModal.type === 'success') { clearAuthTokens(); queryClient.clear(); router.replace('/login'); return; }
              setResultModal(null);
            },
          }}
          onClose={() => {
            if (resultModal.type === 'success') { clearAuthTokens(); queryClient.clear(); router.replace('/login'); return; }
            setResultModal(null);
          }}
        />
      )}

      <div className={cx('row', { ward: variant === 'ward' })}>
        <div className={cx('meta')}>
          <span className={cx('label')}>비밀번호 변경</span>
          <span className={cx('desc')}>{isKakaoUser ? copy.kakaoDesc : copy.desc}</span>
        </div>
        {/* 카카오 가입 계정은 비밀번호가 없으므로 버튼 자체를 두지 않는다 */}
        {!isKakaoUser && !isEditing && (
          <button
            className={cx('ghostButton')}
            type="button"
            disabled={!isAccountReady || mutation.isPending}
            onClick={openEdit}
          >
            변경
          </button>
        )}
      </div>

      {!isKakaoUser && isEditing && (
        <form className={cx('editPanel', { ward: variant === 'ward' })} onSubmit={handleSubmit}>
          <PasswordField autoComplete="current-password" label="현재 비밀번호" value={form.currentPassword} onChange={v => setForm(f => ({ ...f, currentPassword: v }))} />
          <PasswordField autoComplete="new-password" label="새 비밀번호 (8자 이상)" value={form.newPassword} onChange={v => setForm(f => ({ ...f, newPassword: v }))} />
          <PasswordField autoComplete="new-password" label={copy.confirmPlaceholder} value={form.newPasswordConfirm} onChange={v => setForm(f => ({ ...f, newPasswordConfirm: v }))} />

          {(short || mismatch) && (
            <p className={cx('formError')}>
              {short ? copy.shortError : copy.mismatchError}
            </p>
          )}

          <div className={cx('editActions')}>
            <button className={cx('ghostButton')} type="button" disabled={mutation.isPending} onClick={closeEdit}>
              취소
            </button>
            <button className={cx('primaryButton')} type="submit" disabled={!ok || mutation.isPending}>
              {mutation.isPending ? '변경 중…' : '변경하기'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

// autoComplete로 브라우저 비밀번호 관리자가 현재·새 비밀번호를 구분해 저장할 수 있게 한다
function PasswordField({
  autoComplete,
  label,
  value,
  onChange,
}: {
  autoComplete: 'current-password' | 'new-password';
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className={cx('field')}
      type="password"
      aria-label={label}
      autoComplete={autoComplete}
      placeholder={label}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}
