'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { clearAuthTokens } from '@/lib/auth/tokenStore';
import { getModalErrorMessage } from '@/lib/dashboard/profile';
import { changeMyPassword } from '@/service/api/user/user';
import type { IUserPasswordChangeReq } from '@/service/interface/user';
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
  const [formError, setFormError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [resultModal, setResultModal] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const mutation = useMutation({
    mutationFn: changeMyPassword,
    onMutate: () => { setFormError(''); setResultModal(null); },
    onSuccess: () => {
      setIsDialogOpen(false);
      setForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      setResultModal({ message: '비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.', type: 'success' });
    },
    onError: error => setResultModal({ message: getModalErrorMessage(error, '비밀번호 변경에 실패했습니다.'), type: 'error' }),
  });

  const openDialog = () => {
    if (isKakaoUser || mutation.isPending) return;
    setFormError('');
    setForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    if (mutation.isPending) return;
    setIsDialogOpen(false);
    setFormError('');
    setForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isKakaoUser) { setFormError('카카오 가입 계정은 비밀번호를 변경할 수 없습니다.'); return; }
    if (form.newPassword !== form.newPasswordConfirm) { setFormError('새 비밀번호 확인이 일치하지 않습니다.'); return; }
    mutation.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  };

  return (
    <>
      {resultModal && (
        <CommonModal
          type={resultModal.type}
          title={resultModal.type === 'success' ? '비밀번호 변경 완료' : '비밀번호 변경 실패'}
          message={resultModal.message}
          confirmText="확인"
          onClose={() => {
            if (resultModal.type === 'success') { clearAuthTokens(); queryClient.clear(); router.replace('/login'); return; }
            setResultModal(null);
          }}
        />
      )}

      <section className={cx('section')}>
        <div className={cx('sectionHead')}>
          <h2 className={cx('sectionTitle')}>비밀번호 변경</h2>
          <p className={cx('sectionDesc')}>
            {isKakaoUser
              ? '카카오 가입 계정은 비밀번호를 변경할 수 없습니다.'
              : '현재 비밀번호와 새 비밀번호를 확인한 뒤 변경할 수 있습니다.'}
          </p>
        </div>
        <div className={cx('sectionBody')}>
          <button className={cx('changeButton')} type="button" disabled={isKakaoUser || mutation.isPending} onClick={openDialog}>
            {mutation.isPending ? '변경 중…' : '변경하기'}
          </button>
        </div>
      </section>

      {isDialogOpen && (
        <div className={cx('overlay')} role="presentation" onClick={closeDialog}>
          <section
            className={cx('dialog')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwd-dialog-title"
            onClick={e => e.stopPropagation()}
          >
            <div className={cx('dialogHeader')}>
              <div>
                <h3 id="pwd-dialog-title">비밀번호 변경</h3>
                <p>현재 비밀번호와 새 비밀번호를 입력한 뒤 변경을 눌러주세요.</p>
              </div>
              <button className={cx('dialogClose')} type="button" aria-label="닫기" onClick={closeDialog}>×</button>
            </div>

            <form className={cx('dialogForm')} onSubmit={handleSubmit}>
              <div className={cx('dialogGrid')}>
                <PasswordField label="현재 비밀번호" disabled={isKakaoUser} value={form.currentPassword} onChange={v => setForm(f => ({ ...f, currentPassword: v }))} />
                <PasswordField label="새 비밀번호" disabled={isKakaoUser} value={form.newPassword} onChange={v => setForm(f => ({ ...f, newPassword: v }))} />
                <PasswordField label="새 비밀번호 확인" disabled={isKakaoUser} value={form.newPasswordConfirm} onChange={v => setForm(f => ({ ...f, newPasswordConfirm: v }))} />
              </div>

              {formError && <p className={cx('formError')}>{formError}</p>}

              <div className={cx('dialogActions')}>
                <button className={cx('dialogSecondary')} type="button" onClick={closeDialog}>취소</button>
                <button className={cx('dialogPrimary')} type="submit" disabled={isKakaoUser || mutation.isPending}>
                  {mutation.isPending ? '변경 중…' : '변경'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function PasswordField({ label, disabled, value, onChange }: {
  label: string;
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={cx('field')}>
      <span>{label}</span>
      <input type="password" disabled={disabled} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}
