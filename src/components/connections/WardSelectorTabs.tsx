'use client';

import classNames from 'classnames/bind';

import styles from './WardSelectorTabs.module.css';

const cx = classNames.bind(styles);

interface WardOption {
  wardId: string;
  wardName: string | null;
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
            <span className={cx('wardTabAvatar')}>{(ward.wardName ?? '피').charAt(0)}</span>
            {ward.wardName ?? '피보호자'} 님
          </button>
        );
      })}
    </div>
  );
}
