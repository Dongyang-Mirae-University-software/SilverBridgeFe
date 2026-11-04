'use client';

import { useQuery } from '@tanstack/react-query';

import { myProfileQueryOptions } from '@/service/query/user';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { AdminProfileModal } from './AdminProfileModal';
import { GuardianProfileModal } from './GuardianProfileModal';
import { RoleProfileModalProps } from './profileModalTypes';
import { WardProfileModal } from './WardProfileModal';

// 역할별 시안과 정보 밀도가 달라 공용 DOM을 공유하지 않는다.
// 프로필 조회·수정 API는 각 전용 모달에서 같은 실제 컴포넌트를 사용한다.
export function ProfileModal(props: RoleProfileModalProps) {
  // 모달은 열 때의 props로 모달 저장소에 들어가 그 뒤로 다시 그려지지 않는다.
  // 이미지·정보를 바꾸면 갱신되는 프로필 캐시를 직접 읽어야 새로고침 없이 바로 바뀐다
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const liveProfile = getUserProfileData(profileResponse);
  const profile = liveProfile ?? props.profile;
  const modalProps: RoleProfileModalProps = {
    ...props,
    profile,
    userId: liveProfile?.id ?? props.userId,
    userEmail: liveProfile?.email ?? props.userEmail,
    userName: liveProfile?.name ?? props.userName,
  };

  if (props.role === 'WARD') return <WardProfileModal {...modalProps} />;
  if (props.role === 'ADMIN') return <AdminProfileModal {...modalProps} />;
  return <GuardianProfileModal {...modalProps} />;
}
