'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { Icon } from '@/components/Icon';
import { signupSmsSend, signupSmsVerify } from '@/service/api/auth/auth';
import { changeMyPassword, updateMyProfile } from '@/service/api/user/user';
import { GenderType } from '@/service/interface/auth/auth';
import { IUserUpdateReq } from '@/service/interface/user/user';
import { myProfileQueryKey, useProfileImageChangeMutation } from '@/service/query/user';
import { setMyProfileCache } from '@/lib/dashboard/profileCache';
import { clearAuthTokens } from '@/lib/auth/tokenStore';
import { openKakaoPostcode } from '@/lib/postcode/kakaoPostcode';
import { getRoleLabel } from '@/utils/auth/routes';
import { getModalErrorMessage, getProfileFormValue, getSmsVerificationNonce } from '@/utils/dashboard/profile';
import { formatPhoneNumber, getPhoneDigits } from '@/utils/format/phone';
import { getNameInitial } from '@/utils/format/text';
import { ProfileModalFooter } from './ProfileModalFooter';
import { ProfileModalShell } from './ProfileModalShell';
import { WardIdSharePanel } from './WardIdSharePanel';
import { RoleProfileModalProps } from './profileModalTypes';
import styles from './InlineProfileModal.module.css';

const cx = classNames.bind(styles);

const GENDER_LABEL: Record<GenderType, string> = { MALE: '남성', FEMALE: '여성' };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type EditKey = 'name' | 'phone' | 'basic' | 'addr' | 'pw';
type Draft = Partial<IUserUpdateReq> & {
  code?: string;
  currentPassword?: string;
  newPassword?: string;
  newPasswordConfirm?: string;
};

// v13.0 시안 '내 프로필' - 항목마다 '바꾸기'로 그 자리에서 고친다.
// 피보호자(ward): 처음엔 사진·이름·전화와 내 ID 카드만 두고 '정보 바꾸기'로 펼친다. 글자·칸이 더 크다.
// 보호자(guardian): 처음부터 펼친 목록, 사진 옆에 이름·역할.
export function InlineProfileModal({
  variant,
  onClose,
  profile,
  role,
  userId,
  userName,
  userEmail,
}: RoleProfileModalProps & { variant: 'ward' | 'guardian' }) {
  const isWard = variant === 'ward';
  const router = useRouter();
  const queryClient = useQueryClient();
  const [more, setMore] = useState(!isWard);
  const [edit, setEdit] = useState<EditKey | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [message, setMessage] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [copied, setCopied] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const isKakao = profile?.provider === 'KAKAO';
  const phone = profile?.phone ? formatPhoneNumber(profile.phone) : '전화번호 정보 없음';

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const imageMutation = useProfileImageChangeMutation({ onError: setPhotoError });
  const profileMutation = useMutation({
    mutationKey: ['user-profile-update'],
    mutationFn: updateMyProfile,
    onSuccess: response => {
      setMyProfileCache(queryClient, response);
      void queryClient.invalidateQueries({ queryKey: myProfileQueryKey });
      setMessage('');
      closeEdit();
    },
    onError: error => setMessage(getModalErrorMessage(error, '정보를 바꾸지 못했어요.')),
  });
  const smsSendMutation = useMutation({
    mutationKey: ['user-profile-phone-sms-send'],
    mutationFn: signupSmsSend,
    onSuccess: () => {
      setMessage('');
      setCodeSent(true);
      setSeconds(180);
    },
    onError: error => setMessage(getModalErrorMessage(error, '인증번호를 보내지 못했어요.')),
  });
  const smsVerifyMutation = useMutation({
    mutationKey: ['user-profile-phone-sms-verify'],
    mutationFn: signupSmsVerify,
  });
  const passwordMutation = useMutation({
    mutationFn: changeMyPassword,
    onSuccess: () => {
      closeEdit();
      setPasswordChanged(true);
    },
    onError: error => setMessage(getModalErrorMessage(error, '비밀번호를 바꾸지 못했어요.')),
  });
  const isSaving = profileMutation.isPending || smsVerifyMutation.isPending || passwordMutation.isPending;

  const openEdit = (key: EditKey, init: Draft = {}) => {
    setEdit(key);
    setDraft(init);
    setMessage('');
    setCodeSent(false);
    setSeconds(0);
  };
  function closeEdit() {
    setEdit(null);
    setDraft({});
    setCodeSent(false);
    setSeconds(0);
  }

  // 프로필 수정은 전체 값을 함께 보내야 해서 지금 값에 바꾼 칸만 덮어쓴다
  const saveProfile = (changes: Partial<IUserUpdateReq>) =>
    profileMutation.mutate({
      ...getProfileFormValue(profile),
      ...changes,
      verificationNonce: changes.verificationNonce ?? null,
    });

  const savePhone = async () => {
    const nextPhone = getPhoneDigits(draft.phone ?? '');
    try {
      const response = await smsVerifyMutation.mutateAsync({ phone: nextPhone, code: (draft.code ?? '').trim() });
      saveProfile({ phone: nextPhone, verificationNonce: getSmsVerificationNonce(response) });
    } catch (error) {
      setMessage(getModalErrorMessage(error, '인증번호가 맞지 않아요.'));
    }
  };

  const searchAddress = async () => {
    try {
      const { address, postcode } = await openKakaoPostcode();
      setDraft(current => ({ ...current, address, postcode }));
    } catch (error) {
      setMessage(getModalErrorMessage(error, '주소 검색을 불러오지 못했어요.'));
    }
  };

  const pickPhoto = (file?: File) => {
    if (!file || imageMutation.isPending) return;
    if (file.size > MAX_IMAGE_BYTES) return setPhotoError('사진은 5MB까지 올릴 수 있어요');
    setPhotoError('');
    imageMutation.mutate(file);
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage('복사하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const endSession = () => {
    clearAuthTokens();
    queryClient.clear();
    router.replace('/login');
  };

  const editButton = (key: EditKey, init: Draft) =>
    edit === key ? null : (
      <button className={cx('editLink')} type="button" onClick={() => openEdit(key, init)}>
        바꾸기
      </button>
    );
  const saveRow = (ok: boolean, onSave: () => void) => (
    <div className={cx('saveRow')}>
      <button className={cx('ghostButton')} type="button" onClick={closeEdit} disabled={isSaving}>
        취소
      </button>
      <button className={cx('primaryButton')} type="button" disabled={!ok || isSaving} onClick={onSave}>
        {isSaving ? '저장 중' : '저장'}
      </button>
    </div>
  );

  const age = getAge(profile?.birthDate);
  const photo = profile?.profileImage;

  return (
    <ProfileModalShell
      role={role}
      onClose={onClose}
      footer={<ProfileModalFooter onClose={onClose} actionLabel="닫기" />}
    >
      <div className={cx(variant)}>
        {isWard && !more ? (
          <>
            <section className={cx('quickIdentity')}>
              <span className={cx('avatar', 'avatarQuick')}>
                {/* eslint-disable-next-line @next/next/no-img-element -- UserAvatar와 같은 이유(원격 프로필 이미지) */}
                {photo ? <img alt="" src={photo} /> : getNameInitial(userName)}
              </span>
              <div>
                <h2>{userName}</h2>
                <p>{phone}</p>
              </div>
            </section>
            <WardIdSharePanel userId={userId} />
          </>
        ) : isWard ? (
          <section className={cx('detailHero')}>
            <label className={cx('avatar', 'avatarDetail')} aria-label="프로필 사진 바꾸기">
              {/* eslint-disable-next-line @next/next/no-img-element -- UserAvatar와 같은 이유(원격 프로필 이미지) */}
              {photo ? <img alt="" src={photo} /> : getNameInitial(userName)}
              <input
                type="file"
                accept="image/*"
                disabled={imageMutation.isPending}
                onChange={event => {
                  pickPhoto(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
              <span className={cx('cameraBadge')}>
                <Icon name="camera" size={16} decorative />
              </span>
            </label>
            {imageMutation.isPending && <p className={cx('hint')}>사진을 올리는 중이에요</p>}
            {photoError && <p className={cx('error')}>{photoError}</p>}
            {edit === 'name' ? (
              <div className={cx('nameEditor')}>
                <input
                  aria-label="이름"
                  autoFocus
                  className={cx('input', 'nameInput')}
                  maxLength={20}
                  value={draft.name ?? ''}
                  onChange={event => setDraft({ name: event.target.value })}
                />
                <span className={cx('hint')}>{(draft.name ?? '').length} / 20자</span>
                {saveRow(Boolean((draft.name ?? '').trim()), () => saveProfile({ name: (draft.name ?? '').trim() }))}
              </div>
            ) : (
              <button
                className={cx('nameButton')}
                type="button"
                onClick={() => openEdit('name', { name: profile?.name ?? '' })}
              >
                <span>{userName}</span>
                <Icon name="edit" size={20} decorative />
                <span className={cx('srOnly')}>이름 바꾸기</span>
              </button>
            )}
            <span className={cx('rolePill')}>{getRoleLabel(role)}</span>
          </section>
        ) : (
          <section className={cx('rowHero')}>
            <label className={cx('avatar', 'avatarRow')} aria-label="프로필 사진 바꾸기">
              {/* eslint-disable-next-line @next/next/no-img-element -- UserAvatar와 같은 이유(원격 프로필 이미지) */}
              {photo ? <img alt="" src={photo} /> : getNameInitial(userName)}
              <input
                type="file"
                accept="image/*"
                disabled={imageMutation.isPending}
                onChange={event => {
                  pickPhoto(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
              <span className={cx('cameraBadge')}>
                <Icon name="camera" size={13} decorative />
              </span>
            </label>
            <div className={cx('rowHeroText')}>
              {edit === 'name' ? (
                <div className={cx('nameEditor')}>
                  <input
                    aria-label="이름"
                    autoFocus
                    className={cx('input', 'nameInput')}
                    maxLength={20}
                    value={draft.name ?? ''}
                    onChange={event => setDraft({ name: event.target.value })}
                  />
                  {saveRow(Boolean((draft.name ?? '').trim()), () => saveProfile({ name: (draft.name ?? '').trim() }))}
                </div>
              ) : (
                <>
                  <div className={cx('nameRow')}>
                    <h2>{userName}</h2>
                    <button
                      className={cx('nameEditButton')}
                      type="button"
                      aria-label="이름 바꾸기"
                      onClick={() => openEdit('name', { name: profile?.name ?? '' })}
                    >
                      <Icon name="edit" size={15} decorative />
                    </button>
                  </div>
                  <span className={cx('rolePill')}>{getRoleLabel(role)}</span>
                </>
              )}
            </div>
          </section>
        )}
        {!isWard && imageMutation.isPending && <p className={cx('hint')}>사진을 올리는 중이에요</p>}
        {!isWard && photoError && <p className={cx('error')}>{photoError}</p>}

        {isWard && (
          <button
            className={cx('ghostButton', 'toggleButton')}
            type="button"
            aria-expanded={more}
            onClick={() => {
              setMore(value => !value);
              closeEdit();
              setMessage('');
            }}
          >
            {more ? '간단히 보기' : '정보 바꾸기'}
            <span className={cx('chevron', { open: more })} aria-hidden="true">
              ▼
            </span>
          </button>
        )}

        {more && (
          <>
            {message && (
              <p className={cx('error')} role="alert">
                {message}
              </p>
            )}

            <Group title="계정">
              {isWard && (
                <Item
                  label="내 ID"
                  action={
                    <button className={cx('ghostButton', 'copyButton')} type="button" onClick={() => void copyId()}>
                      {copied ? '복사했어요' : '복사'}
                    </button>
                  }
                >
                  <span className={cx('memberId')}>{userId}</span>
                </Item>
              )}
              <Item label="로그인">
                {isKakao ? (
                  <span className={cx('kakaoLogin')}>
                    <span className={cx('kakaoMark')} aria-hidden="true">
                      K
                    </span>
                    카카오로 로그인
                  </span>
                ) : (
                  userEmail
                )}
              </Item>
              <Item label="가입 방식">{isKakao ? '카카오' : '이메일'}</Item>
              {profile?.createdAt && <Item label="가입일">{formatKoreanDate(profile.createdAt)}</Item>}
              {!isKakao && (
                <Item
                  label="비밀번호"
                  action={editButton('pw', { currentPassword: '', newPassword: '', newPasswordConfirm: '' })}
                >
                  ••••••••
                </Item>
              )}
              {edit === 'pw' && (
                <div className={cx('panel')}>
                  <input
                    aria-label="현재 비밀번호"
                    className={cx('input')}
                    type="password"
                    placeholder="현재 비밀번호"
                    value={draft.currentPassword ?? ''}
                    onChange={event => setDraft({ ...draft, currentPassword: event.target.value })}
                  />
                  <input
                    aria-label="새 비밀번호"
                    className={cx('input')}
                    type="password"
                    placeholder="새 비밀번호 (8자 이상)"
                    value={draft.newPassword ?? ''}
                    onChange={event => setDraft({ ...draft, newPassword: event.target.value })}
                  />
                  <input
                    aria-label="새 비밀번호 확인"
                    className={cx('input')}
                    type="password"
                    placeholder="새 비밀번호 확인"
                    value={draft.newPasswordConfirm ?? ''}
                    onChange={event => setDraft({ ...draft, newPasswordConfirm: event.target.value })}
                  />
                  {draft.newPassword && draft.newPassword.length < 8 && (
                    <p className={cx('error')}>새 비밀번호는 8자 이상이어야 해요</p>
                  )}
                  {draft.newPasswordConfirm && draft.newPasswordConfirm !== draft.newPassword && (
                    <p className={cx('error')}>새 비밀번호가 서로 달라요</p>
                  )}
                  {saveRow(
                    Boolean(
                      draft.currentPassword &&
                      draft.newPassword &&
                      draft.newPassword.length >= 8 &&
                      draft.newPasswordConfirm === draft.newPassword,
                    ),
                    () =>
                      passwordMutation.mutate({
                        currentPassword: draft.currentPassword ?? '',
                        newPassword: draft.newPassword ?? '',
                      }),
                  )}
                </div>
              )}
            </Group>

            <Group title="내 정보">
              <Item label="전화번호" action={editButton('phone', { phone: '', code: '' })}>
                {phone}
              </Item>
              {edit === 'phone' && (
                <div className={cx('panel')}>
                  <div className={cx('inlineRow')}>
                    <input
                      aria-label="새 전화번호"
                      className={cx('input')}
                      inputMode="tel"
                      placeholder="새 전화번호"
                      value={draft.phone ?? ''}
                      onChange={event => setDraft({ ...draft, phone: event.target.value })}
                    />
                    <button
                      className={cx('primaryButton')}
                      type="button"
                      disabled={
                        seconds > 0 || smsSendMutation.isPending || getPhoneDigits(draft.phone ?? '').length < 10
                      }
                      onClick={() => smsSendMutation.mutate({ phone: getPhoneDigits(draft.phone ?? '') })}
                    >
                      {codeSent ? '다시 받기' : '인증번호 받기'}
                    </button>
                  </div>
                  {codeSent && (
                    <input
                      aria-label="인증번호"
                      className={cx('input')}
                      inputMode="numeric"
                      placeholder={`문자로 받은 인증번호 · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
                      value={draft.code ?? ''}
                      onChange={event =>
                        setDraft({ ...draft, code: event.target.value.replace(/\D/g, '').slice(0, 6) })
                      }
                    />
                  )}
                  {saveRow(codeSent && (draft.code ?? '').length >= 4, () => void savePhone())}
                </div>
              )}
              <Item
                label="성별 · 생년월일"
                action={editButton('basic', { gender: profile?.gender ?? '', birthDate: profile?.birthDate ?? '' })}
              >
                {profile?.gender ? GENDER_LABEL[profile.gender] : '성별 정보 없음'} ·{' '}
                {profile?.birthDate ? formatKoreanDate(profile.birthDate) : '생년월일 정보 없음'}
                {age !== null && <span className={cx('mute')}> (만 {age}세)</span>}
              </Item>
              {edit === 'basic' && (
                <div className={cx('panel')}>
                  <div className={cx('genderRow')} role="radiogroup" aria-label="성별">
                    {(['MALE', 'FEMALE'] as const).map(gender => (
                      <button
                        key={gender}
                        className={cx('genderButton', { on: draft.gender === gender })}
                        type="button"
                        role="radio"
                        aria-checked={draft.gender === gender}
                        onClick={() => setDraft({ ...draft, gender })}
                      >
                        {GENDER_LABEL[gender]}
                      </button>
                    ))}
                  </div>
                  <input
                    aria-label="생년월일"
                    className={cx('input')}
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={draft.birthDate ?? ''}
                    onChange={event => setDraft({ ...draft, birthDate: event.target.value })}
                  />
                  {saveRow(Boolean(draft.gender && draft.birthDate), () =>
                    saveProfile({ gender: draft.gender, birthDate: draft.birthDate }),
                  )}
                </div>
              )}
              <Item
                label="주소"
                action={editButton('addr', {
                  postcode: profile?.postcode ?? '',
                  address: profile?.address ?? '',
                  addressDetail: profile?.addressDetail ?? '',
                })}
              >
                {profile?.address || '주소 정보 없음'}
                {profile?.addressDetail ? `, ${profile.addressDetail}` : ''}
                {profile?.postcode && <div className={cx('subValue')}>우편번호 {profile.postcode}</div>}
              </Item>
              {edit === 'addr' && (
                <div className={cx('panel')}>
                  <div className={cx('inlineRow')}>
                    <input
                      aria-label="주소"
                      className={cx('input', 'readOnlyInput')}
                      readOnly
                      placeholder="주소를 찾아 주세요"
                      value={draft.postcode ? `(${draft.postcode}) ${draft.address ?? ''}` : ''}
                    />
                    <button className={cx('primaryButton')} type="button" onClick={() => void searchAddress()}>
                      주소 찾기
                    </button>
                  </div>
                  <input
                    aria-label="상세 주소"
                    className={cx('input')}
                    placeholder="상세 주소 (동·호수)"
                    value={draft.addressDetail ?? ''}
                    onChange={event => setDraft({ ...draft, addressDetail: event.target.value })}
                  />
                  {saveRow(Boolean(draft.address), () =>
                    saveProfile({
                      postcode: draft.postcode,
                      address: draft.address,
                      addressDetail: (draft.addressDetail ?? '').trim(),
                    }),
                  )}
                </div>
              )}
            </Group>
          </>
        )}
        <div className={cx('bottomSpace')} />
      </div>

      {passwordChanged && (
        <CommonModal
          type="success"
          title="비밀번호 변경 완료"
          message="비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요."
          primaryButton={{ text: '확인', onClick: endSession }}
          onClose={endSession}
        />
      )}
    </ProfileModalShell>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cx('group')}>
      <h3>{title}</h3>
      <div className={cx('list')}>{children}</div>
    </section>
  );
}

function Item({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={cx('item')}>
      <span className={cx('itemLabel')}>{label}</span>
      <div className={cx('itemValue')}>{children}</div>
      {action}
    </div>
  );
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return `${year}년 ${month}월 ${day}일`;
}

function getAge(birthDate?: string | null) {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  return age;
}
