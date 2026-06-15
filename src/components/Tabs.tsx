'use client';

import type { CSSProperties, ReactNode } from 'react';
import classNames from 'classnames/bind';

import styles from './Tabs.module.css';

const cx = classNames.bind(styles);

export type TabItem<T extends string = string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

type TabsProps<T extends string = string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  stretch?: boolean;
  size?: 'sm' | 'md';
  className?: string;
};

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
  stretch = false,
  size = 'md',
  className,
}: TabsProps<T>) {
  return (
    <div
      className={cx('tabs', className, { stretch, sm: size === 'sm', md: size === 'md' })}
      role="tablist"
      aria-label={ariaLabel}
      style={{ '--tabs-count': String(items.length) } as CSSProperties}
    >
      {items.map(item => {
        const isActive = value === item.value;
        return (
          <button
            key={String(item.value)}
            className={cx('tab', { active: isActive, disabled: item.disabled })}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
