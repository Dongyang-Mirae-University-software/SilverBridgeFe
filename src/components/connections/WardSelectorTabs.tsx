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
}

export function WardSelectorTabs({ wards, selectedWardId, onSelect, ariaLabel = '피보호자 선택' }: WardSelectorTabsProps) {
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
