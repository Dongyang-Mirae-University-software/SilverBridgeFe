'use client';

import { AdminProfileModal } from './AdminProfileModal';
import { GuardianProfileModal } from './GuardianProfileModal';
import { RoleProfileModalProps } from './profileModalTypes';
import { WardProfileModal } from './WardProfileModal';

// 역할별 시안과 정보 밀도가 달라 공용 DOM을 공유하지 않는다.
// 프로필 조회·수정 API는 각 전용 모달에서 같은 실제 컴포넌트를 사용한다.
export function ProfileModal(props: RoleProfileModalProps) {
  if (props.role === 'WARD') return <WardProfileModal {...props} />;
  if (props.role === 'ADMIN') return <AdminProfileModal {...props} />;
  return <GuardianProfileModal {...props} />;
}
