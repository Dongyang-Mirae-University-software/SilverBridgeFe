'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { CommonModal } from '@/components/CommonModal';
import { signupSmsSend, signupSmsVerify } from '@/service/api/auth';
import { changeMyPassword, deleteMyAccount, updateMyProfile } from '@/service/api/user';
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
import { cx } from './styles';

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
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isDeleteCompleteModalOpen, setIsDeleteCompleteModalOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [activePanel, setActivePanel] = useState<'profile' | 'security'>('profile');
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
    onSuccess: () => setPasswordModal({ message: '비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.', type: 'success' }),
    onError: error => setPasswordModal({ message: getModalErrorMessage(error, '비밀번호 변경에 실패했습니다.'), type: 'error' }),
  });
  const deleteMutation = useMutation({
    mutationKey: ['user-account-delete'],
    mutationFn: deleteMyAccount,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: () => setIsDeleteCompleteModalOpen(true),
    onError: error => setFeedbackMessage(getModalErrorMessage(error, '회원 탈퇴에 실패했습니다.')),
  });

  const updateProfileForm = (field: keyof IUserUpdateReq, value: string) => {
    setProfileForm(current => ({ ...current, [field]: value }));
    if (field === 'phone') {
      setPhoneCode('');
      setPhoneNonce(null);
    }
  };

  const handlePanelChange = (panel: 'profile' | 'security') => {
    if (panel === activePanel) return;
    setFeedbackMessage('');
    setProfileForm(getProfileFormValue(profile));
    setPhoneCode('');
    setPhoneNonce(null);
    setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
    setDeletePassword('');
    setDeleteConfirmation('');
    setActivePanel(panel);
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

  const handleDeleteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!window.confirm('정말 회원 탈퇴를 진행할까요? 탈퇴 후 해당 계정으로 로그인할 수 없습니다.')) return;
    deleteMutation.mutate(isKakaoUser ? { confirmation: deleteConfirmation } : { password: deletePassword });
  };

  return (
    <div className={cx('profileManageStack')}>
      {isDeleteCompleteModalOpen && (
        <CommonModal
          type="success"
          tone={profile?.role === 'GUARDIAN' ? 'guardian' : 'default'}
          title="회원 탈퇴가 완료되었습니다"
          message="그동안 이용해 주셔서 감사합니다."
          confirmText="확인"
          onClose={() => redirectToLogin(queryClient, router)}
        />
      )}
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
      <ProfileTabs activePanel={activePanel} onChange={handlePanelChange} />
      <div className={cx('profileManageScroll')}>
        {activePanel === 'profile' ? (
          <ProfileInfoPanel
            form={profileForm}
            isPhoneChanged={isPhoneChanged}
            isProfilePending={profileMutation.isPending}
            onAddressSearch={handleAddressSearch}
            onChange={updateProfileForm}
            onSubmit={handleProfileSubmit}
            phoneCode={phoneCode}
            phoneNonce={phoneNonce}
            setPhoneCode={setPhoneCode}
            smsSendMutation={smsSendMutation}
            smsVerifyMutation={smsVerifyMutation}
          />
        ) : (
          <ProfileSecurityPanel
            deleteConfirmation={deleteConfirmation}
            deletePassword={deletePassword}
            isDeletePending={deleteMutation.isPending}
            isKakaoUser={isKakaoUser}
            isPasswordPending={passwordMutation.isPending}
            onDeleteSubmit={handleDeleteSubmit}
            onPasswordChange={setPasswordForm}
            onPasswordSubmit={handlePasswordSubmit}
            passwordForm={passwordForm}
            setDeleteConfirmation={setDeleteConfirmation}
            setDeletePassword={setDeletePassword}
          />
        )}
      </div>
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

function ProfileTabs({ activePanel, onChange }: { activePanel: 'profile' | 'security'; onChange: (panel: 'profile' | 'security') => void }) {
  return (
    <div className={cx('profileTabsBar')} role="tablist" aria-label="사용자 정보 관리">
      <button className={cx('profileTab', { profileTabActive: activePanel === 'profile' })} type="button" onClick={() => onChange('profile')}>
        기본 정보
      </button>
      <button className={cx('profileTab', { profileTabActive: activePanel === 'security' })} type="button" onClick={() => onChange('security')}>
        보안
      </button>
    </div>
  );
}

function getValidatedProfile(form: IUserUpdateReq, isPhoneChanged: boolean, phoneNonce: string | null): IUserUpdateReq | string {
  const name = (form.name ?? '').trim();
  const phone = (form.phone ?? '').trim();
  const birthDate = form.birthDate ?? '';
  const postcode = (form.postcode ?? '').trim();
  const address = (form.address ?? '').trim();
  const addressDetail = (form.addressDetail ?? '').trim();
  if (!name) return '이름을 입력하세요.';
  if (!/^\d{10,11}$/.test(phone)) return '전화번호는 숫자 10~11자리로 입력하세요.';
  if (!birthDate || !postcode || !address) return '생년월일, 우편번호, 주소를 모두 입력하세요.';
  if (isPhoneChanged && !phoneNonce) return '전화번호를 변경하려면 SMS 인증을 완료하세요.';
  return { ...form, address, addressDetail, birthDate, name, phone, postcode, verificationNonce: isPhoneChanged ? phoneNonce : null };
}

function redirectToLogin(queryClient: ReturnType<typeof useQueryClient>, router: ReturnType<typeof useRouter>) {
  clearAuthTokens();
  queryClient.clear();
  router.replace('/login');
}
