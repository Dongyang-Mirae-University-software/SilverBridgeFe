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
  ariaLabel = '어르신 선택',
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
            <UserAvatar imageUrl={ward.profileImage} size="w-30" userName={wardDisplayName(ward.wardName)} />
            <span>{wardDisplayName(ward.wardName)}</span>
            {/* relation은 "보호자가 어르신에게 누구인지"(예: 딸)라 이름 옆에 두면 "이윤아 = 내 딸"로 거꾸로 읽힌다 - 칩에는 호칭만 둔다 */}
            <em>어르신</em>
            {!!ward.badgeCount && <i className={cx('wardTabBadge')}>{ward.badgeCount}</i>}
          </button>
        );
      })}
    </div>
  );
}

// 빈 글자('')·공백 이름도 이름 없이 관계만 보이지 않게 대체 이름을 쓴다(QA CONN-A25)
export function wardDisplayName(name: string | null | undefined) {
  return name?.trim() || '이름 없음';
}
