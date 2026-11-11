'use client';

import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import styles from './WardSelectorTabs.module.css';

const cx = classNames.bind(styles);

export interface WardOption {
  wardId: string;
  wardName: string | null;
  profileImage?: string | null;
  relation?: string | null;
  badgeCount?: number | null;
}

interface WardSelectorTabsProps {
  wards: WardOption[];
  selectedWardId?: string;
  onSelect: (wardId: string) => void;
  ariaLabel?: string;
  /** 바꿀 수 없는 동안(예: 예약 진행 중) 누를 수 없게 한다. 기본은 누를 수 있음. */
  disabled?: boolean;
}

export function WardSelectorTabs({
  wards,
  selectedWardId,
  onSelect,
  ariaLabel = '피보호자 선택',
  disabled = false,
}: WardSelectorTabsProps) {
  return (
    <div className={cx('wardTabs')} role="tablist" aria-label={ariaLabel}>
      {wards.map(ward => {
        const isActive = ward.wardId === selectedWardId;
        return (
          <button
            key={ward.wardId}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            className={cx('wardTab', { wardTabActive: isActive })}
            onClick={() => onSelect(ward.wardId)}
          >
            <UserAvatar imageUrl={ward.profileImage} size="w-30" userName={ward.wardName} />
            <span>{ward.wardName ?? '피보호자'}</span>
            {ward.relation && <em>{ward.relation}</em>}
            {!!ward.badgeCount && <i className={cx('wardTabBadge')}>{ward.badgeCount}</i>}
          </button>
        );
      })}
    </div>
  );
}
