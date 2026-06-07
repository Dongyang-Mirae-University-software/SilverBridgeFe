'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { CommonModal } from '@/components/CommonModal';
import { signupSmsSend, signupSmsVerify } from '@/service/api/auth';
import { changeMyPassword, updateMyProfile } from '@/service/api/user';
import { IUserProfile, IUserUpdateReq } from '@/service/interface/user';
import { myProfileQueryKey } from '@/service/query/user';
import { clearAuthTokens } from '@/lib/auth/tokenStore';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { setMyProfileCache } from '@/lib/dashboard/profileCache';
import { ProfileInfoPanel } from './ProfileInfoPanel';
import { ProfileSecurityPanel } from './ProfileSecurityPanel';
import { getModalErrorMessage, getProfileFormValue, getSmsVerificationNonce } from '@/lib/dashboard/profile';
import { getPhoneDigits } from '@/lib/format/phone';
import { openKakaoPostcode } from '@/lib/postcode/kakaoPostcode';
import classNames from 'classnames/bind';
import styles from './ProfileModalControls.module.css';

const cx = classNames.bind(styles);

interface Props {
  isLoggingOut: boolean;
  onClose: () => void;
  onLogout: () => void;
  profile: IUserProfile | null;
}

export function ProfileModalControls({ profile, isLoggingOut, onClose, onLogout }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState<IUserUpdateReq>(getProfileFormValue(profile));
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneNonce, setPhoneNonce] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [passwordModal, setPasswordModal] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const isKakaoUser = profile?.provider === 'KAKAO';
  const isPhoneChanged = (profileForm.phone ?? '').trim() !== getPhoneDigits(profile?.phone ?? '');

  const profileMutation = useMutation({
    mutationKey: ['user-profile-update'],
    mutationFn: updateMyProfile,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async response => {
      const profile = setMyProfileCache(queryClient, response) ?? getUserProfileData(response);
      setProfileForm(getProfileFormValue(profile));
      setPhoneCode('');
      setPhoneNonce(null);
      setFeedbackMessage('프로필 정보를 수정했습니다.');
      void queryClient.invalidateQueries({ queryKey: myProfileQueryKey });
    },
    onError: error => setFeedbackMessage(getModalErrorMessage(error, '프로필 수정에 실패했습니다.')),
  });
  const smsSendMutation = useMutation({
    mutationKey: ['user-profile-phone-sms-send'],
    mutationFn: signupSmsSend,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: () => setFeedbackMessage('새 전화번호로 인증번호를 보냈습니다.'),
    onError: error => setFeedbackMessage(getModalErrorMessage(error, '인증번호 발송에 실패했습니다.')),
  });
  const smsVerifyMutation = useMutation({
    mutationKey: ['user-profile-phone-sms-verify'],
    mutationFn: signupSmsVerify,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: response => {
      setPhoneNonce(getSmsVerificationNonce(response));
      setFeedbackMessage('전화번호 인증이 완료되었습니다.');
    },
    onError: error => setFeedbackMessage(getModalErrorMessage(error, '전화번호 인증에 실패했습니다.')),
  });
  const passwordMutation = useMutation({
    mutationKey: ['user-password-change'],
    mutationFn: changeMyPassword,
    onMutate: () => {
      setFeedbackMessage('');
      setPasswordModal(null);
    },
    onSuccess: () => {
      setIsPasswordDialogOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      setPasswordModal({ message: '비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.', type: 'success' });
    },
    onError: error => setPasswordModal({ message: getModalErrorMessage(error, '비밀번호 변경에 실패했습니다.'), type: 'error' }),
  });
  const updateProfileForm = (field: keyof IUserUpdateReq, value: string) => {
    setProfileForm(current => ({ ...current, [field]: value }));
    if (field === 'phone') {
      setPhoneCode('');
      setPhoneNonce(null);
    }
  };

  const handleProfileEditStart = () => {
    setFeedbackMessage('');
    setIsProfileEditing(true);
  };

  const handleProfileEditCancel = () => {
    setFeedbackMessage('');
    setProfileForm(getProfileFormValue(profile));
    setPhoneCode('');
    setPhoneNonce(null);
    setIsProfileEditing(false);
  };

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextProfile = getValidatedProfile(profileForm, isPhoneChanged, phoneNonce);
    if (typeof nextProfile === 'string') return setFeedbackMessage(nextProfile);
    profileMutation.mutate(nextProfile);
  };

  const handleAddressSearch = async () => {
    try {
      const { address, postcode } = await openKakaoPostcode();
      setProfileForm(current => ({ ...current, address, postcode }));
    } catch (error) {
      setFeedbackMessage(getModalErrorMessage(error, '주소 검색을 불러오지 못했습니다.'));
    }
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isKakaoUser) return setFeedbackMessage('카카오 가입 계정은 비밀번호를 변경할 수 없습니다.');
    if (passwordForm.newPassword !== passwordForm.newPasswordConfirm) return setFeedbackMessage('새 비밀번호 확인이 일치하지 않습니다.');
    passwordMutation.mutate({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
  };

  const handlePasswordDialogOpen = () => {
    if (isKakaoUser || passwordMutation.isPending) return;
    setFeedbackMessage('');
    setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
    setIsPasswordDialogOpen(true);
  };

  const handlePasswordDialogClose = () => {
    if (passwordMutation.isPending) return;
    setIsPasswordDialogOpen(false);
    setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  };

  return (
    <div className={cx('profileManageStack')}>
      {passwordModal && (
        <CommonModal
          type={passwordModal.type}
          tone={profile?.role === 'GUARDIAN' ? 'guardian' : 'default'}
          title={passwordModal.type === 'success' ? '비밀번호 변경 완료' : '비밀번호 변경 실패'}
          message={passwordModal.message}
          confirmText="확인"
          onClose={() => {
            if (passwordModal.type === 'success') {
              redirectToLogin(queryClient, router);
              return;
            }

            setPasswordModal(null);
          }}
        />
      )}
      {feedbackMessage && <p className={cx('profileModalMessage')}>{feedbackMessage}</p>}

      <div className={cx('profileManageScroll')}>
        <ProfileInfoPanel
          form={profileForm}
          isEditing={isProfileEditing}
          isPhoneChanged={isPhoneChanged}
          isProfilePending={profileMutation.isPending}
          onAddressSearch={handleAddressSearch}
          onCancelEdit={handleProfileEditCancel}
          onChange={updateProfileForm}
          onEditStart={handleProfileEditStart}
          onSubmit={handleProfileSubmit}
          phoneCode={phoneCode}
          phoneNonce={phoneNonce}
          setPhoneCode={setPhoneCode}
          smsSendMutation={smsSendMutation}
          smsVerifyMutation={smsVerifyMutation}
        />
        <ProfileSecurityPanel
          isKakaoUser={isKakaoUser}
          isPasswordPending={passwordMutation.isPending}
          onOpenPasswordDialog={handlePasswordDialogOpen}
        />
      </div>

      {isPasswordDialogOpen && (
        <PasswordChangeDialog
          isKakaoUser={isKakaoUser}
          isPending={passwordMutation.isPending}
          onCancel={handlePasswordDialogClose}
          onChange={setPasswordForm}
          onSubmit={handlePasswordSubmit}
          passwordForm={passwordForm}
        />
      )}

      <div className={cx('profileModalFooter')}>
        <button className={cx('logoutButton')} type="button" disabled={isLoggingOut} onClick={onLogout}>
          {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
        <button className={cx('profileModalGhostButton')} type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

function getValidatedProfile(form: IUserUpdateReq, isPhoneChanged: boolean, phoneNonce: string | null): IUserUpdateReq | string {
  const name = (form.name ?? '').trim();
  const phone = (form.phone ?? '').trim();
  const gender = form.gender;
  const birthDate = form.birthDate ?? '';
  const postcode = (form.postcode ?? '').trim();
  const address = (form.address ?? '').trim();
  const addressDetail = (form.addressDetail ?? '').trim();
  if (!name) return '이름을 입력하세요.';
  if (!/^\d{10,11}$/.test(phone)) return '전화번호는 숫자 10~11자리로 입력하세요.';
  if (!gender) return '성별을 선택하세요.';
  if (!birthDate || !postcode || !address) return '생년월일, 우편번호, 주소를 모두 입력하세요.';
  if (isPhoneChanged && !phoneNonce) return '전화번호를 변경하려면 SMS 인증을 완료하세요.';
  return { ...form, address, addressDetail, birthDate, gender, name, phone, postcode, verificationNonce: isPhoneChanged ? phoneNonce : null };
}

function redirectToLogin(queryClient: ReturnType<typeof useQueryClient>, router: ReturnType<typeof useRouter>) {
  clearAuthTokens();
  queryClient.clear();
  router.replace('/login');
}

function PasswordChangeDialog({
  isKakaoUser,
  isPending,
  onCancel,
  onChange,
  onSubmit,
  passwordForm,
}: {
  isKakaoUser: boolean;
  isPending: boolean;
  onCancel: () => void;
  onChange: (form: { currentPassword: string; newPassword: string; newPasswordConfirm: string }) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  passwordForm: { currentPassword: string; newPassword: string; newPasswordConfirm: string };
}) {
  return (
    <div className={cx('passwordDialogOverlay')} role="presentation" onClick={onCancel}>
      <section className={cx('passwordDialog')} role="dialog" aria-modal="true" aria-labelledby="password-dialog-title" onClick={event => event.stopPropagation()}>
        <div className={cx('passwordDialogHeader')}>
          <div>
            <h3 id="password-dialog-title">비밀번호 변경</h3>
            <p>현재 비밀번호와 새 비밀번호를 입력한 뒤 변경을 눌러주세요.</p>
          </div>
          <button className={cx('passwordDialogClose')} type="button" aria-label="닫기" onClick={onCancel}>
            ×
          </button>
        </div>

        <form className={cx('passwordDialogForm')} onSubmit={onSubmit}>
          <div className={cx('passwordDialogGrid')}>
            <PasswordField
              disabled={isKakaoUser}
              label="현재 비밀번호"
              value={passwordForm.currentPassword}
              onChange={value => onChange({ ...passwordForm, currentPassword: value })}
            />
            <PasswordField
              disabled={isKakaoUser}
              label="새 비밀번호"
              value={passwordForm.newPassword}
              onChange={value => onChange({ ...passwordForm, newPassword: value })}
            />
            <PasswordField
              disabled={isKakaoUser}
              label="새 비밀번호 확인"
              value={passwordForm.newPasswordConfirm}
              onChange={value => onChange({ ...passwordForm, newPasswordConfirm: value })}
            />
          </div>

          <div className={cx('passwordDialogActions')}>
            <button className={cx('passwordDialogSecondaryButton')} type="button" onClick={onCancel}>
              취소
            </button>
            <button className={cx('passwordDialogPrimaryButton')} type="submit" disabled={isKakaoUser || isPending}>
              {isPending ? '변경 중' : '변경'}
            </button>
          </div>
        </form>
      </section>
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
    <label className={cx('passwordDialogField')}>
      <span>{label}</span>
      <input type="password" disabled={disabled} value={value} onChange={event => onChange(event.target.value)} />
    </label>
  );
}
