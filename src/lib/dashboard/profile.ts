import { IUserProfile, IUserUpdateReq } from '@/service/interface/user';
import { getPhoneDigits } from '@/lib/format/phone';

export function getProviderLabel(provider?: string) {
  if (provider === 'KAKAO') return '카카오';
  if (provider === 'LOCAL') return '일반';
  return '확인 전';
}

export function formatProfileDate(value?: string) {
  if (!value) return '정보 없음';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '정보 없음';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getProfileFormValue(profile?: IUserProfile | null): IUserUpdateReq {
  return {
    address: profile?.address ?? '',
    addressDetail: profile?.addressDetail ?? '',
    birthDate: profile?.birthDate ?? '',
    gender: profile?.gender ?? '',
    name: profile?.name ?? '',
    phone: getPhoneDigits(profile?.phone ?? ''),
    postcode: profile?.postcode ?? '',
    verificationNonce: null,
  };
}

export function getModalErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function getSmsVerificationNonce(response: unknown) {
  const data = (response as { data?: unknown } | undefined)?.data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;
  const verificationData = (nestedData ?? data ?? response) as { verificationNonce?: string } | null;

  return verificationData?.verificationNonce ?? '';
}
