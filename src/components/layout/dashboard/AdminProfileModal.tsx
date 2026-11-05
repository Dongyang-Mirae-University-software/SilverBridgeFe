'use client';

import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { UserAvatar } from '@/components/UserAvatar';
import { InlineProfileModal } from './InlineProfileModal';
import { RoleProfileModalProps } from './profileModalTypes';
import styles from './AdminProfileModal.module.css';

const cx = classNames.bind(styles);

// 운영자 카드·권한 안내만 따로 두고, 정보 목록과 항목별 바꾸기는 보호자 모달과 같다
export function AdminProfileModal(props: RoleProfileModalProps) {
  const { profile, userEmail, userName } = props;

  return (
    <InlineProfileModal
      variant="guardian"
      {...props}
      hero={
        <>
          <section className={cx('hero')}>
            <UserAvatar size="w-72" imageUrl={profile?.profileImage} userName={userName} isChange isDelete />
            <div>
              <span className={cx('roleBadge')}><Icon name="settings" size={14} decorative /> 관리자</span>
              <h2>{userName}</h2>
              <p>{userEmail}</p>
            </div>
          </section>
          <section className={cx('accessCard')}>
            <div className={cx('accessIcon')}><Icon name="lock" size={19} decorative /></div>
            <div><strong>운영자 계정</strong><p>서비스 운영과 관리 기능에 접근할 수 있어요.</p></div>
          </section>
        </>
      }
    />
  );
}
