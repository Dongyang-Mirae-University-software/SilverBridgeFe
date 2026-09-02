'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { signupSmsSend, signupSmsVerify } from '@/service/api/auth/auth';
import { updateMyProfile } from '@/service/api/user/user';
import { IUserProfile, IUserUpdateReq } from '@/service/interface/user/user';
import { myProfileQueryKey } from '@/service/query/user';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { setMyProfileCache } from '@/lib/dashboard/profileCache';
import { ProfileInfoPanel } from './ProfileInfoPanel';
import { getModalErrorMessage, getProfileFormValue, getSmsVerificationNonce } from '@/utils/dashboard/profile';
import { getPhoneDigits } from '@/utils/format/phone';
import { openKakaoPostcode } from '@/lib/postcode/kakaoPostcode';
import classNames from 'classnames/bind';
import styles from './ProfileModalControls.module.css';

const cx = classNames.bind(styles);

interface Props {
  profile: IUserProfile | null;
}

export function ProfileModalControls({ profile }: Props) {
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState<IUserUpdateReq>(getProfileFormValue(profile));
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneNonce, setPhoneNonce] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isProfileEditing, setIsProfileEditing] = useState(false);
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

  return (
    <div className={cx('profileManageStack')}>
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
      </div>
    </div>
  );
}

function getValidatedProfile(form: IUserUpdateReq, isPhoneChanged: boolean, phoneNonce: string | null): IUserUpdateReq | string {
  const name = (form.name ?? '').trim();
  const phone = (form.phone ?? '').trim();
  const gender = form.gender;
  const birthDate = normalizeBirthDateForApi(form.birthDate ?? '');
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

function normalizeBirthDateForApi(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}
