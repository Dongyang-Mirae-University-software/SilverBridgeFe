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

export function PasswordChangeSection({ isKakaoUser }: { isKakaoUser: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();

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

      <div className={cx('row')}>
        <div className={cx('meta')}>
          <span className={cx('label')}>비밀번호 변경</span>
          <span className={cx('desc')}>
            {isKakaoUser ? '카카오 가입 계정은 비밀번호를 변경할 수 없습니다.' : '로그인할 때 쓰는 비밀번호를 바꿉니다'}
          </span>
        </div>
        {!isEditing && (
          <button className={cx('ghostButton')} type="button" disabled={isKakaoUser || mutation.isPending} onClick={openEdit}>
            변경
          </button>
        )}
      </div>

      {isEditing && (
        <form className={cx('editPanel')} onSubmit={handleSubmit}>
          <PasswordField label="현재 비밀번호" value={form.currentPassword} onChange={v => setForm(f => ({ ...f, currentPassword: v }))} />
          <PasswordField label="새 비밀번호 (8자 이상)" value={form.newPassword} onChange={v => setForm(f => ({ ...f, newPassword: v }))} />
          <PasswordField label="새 비밀번호 확인" value={form.newPasswordConfirm} onChange={v => setForm(f => ({ ...f, newPasswordConfirm: v }))} />

          {(short || mismatch) && (
            <p className={cx('formError')}>
              {short ? '새 비밀번호는 8자 이상이어야 합니다.' : '새 비밀번호가 서로 다릅니다.'}
            </p>
          )}

          <div className={cx('editActions')}>
            <button className={cx('ghostButton')} type="button" onClick={closeEdit}>
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

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <input className={cx('field')} type="password" placeholder={label} value={value} onChange={e => onChange(e.target.value)} />;
}
