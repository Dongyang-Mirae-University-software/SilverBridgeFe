'use client';

import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
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
  variant?: 'pill' | 'underline';
  className?: string;
};

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
  stretch = false,
  size = 'md',
  variant = 'pill',
  className,
}: TabsProps<T>) {
  // 키보드: 선택된 탭(없으면 첫 사용 가능 탭)만 Tab 순서에 두고, 탭 사이는 ←/→·Home/End로 옮긴다(WAI-ARIA tabs).
  // 옮기면 바로 그 탭을 고른다 - 마우스로 누르는 것과 같은 동작(자동 활성화)
  const enabledValues = items.filter(item => !item.disabled).map(item => item.value);
  const focusValue = enabledValues.includes(value) ? value : enabledValues[0];

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: T) => {
    if (enabledValues.length === 0) return;
    const index = enabledValues.indexOf(current);
    let next: T | undefined;
    if (event.key === 'ArrowRight') next = enabledValues[(index + 1) % enabledValues.length];
    else if (event.key === 'ArrowLeft') next = enabledValues[(index - 1 + enabledValues.length) % enabledValues.length];
    else if (event.key === 'Home') next = enabledValues[0];
    else if (event.key === 'End') next = enabledValues[enabledValues.length - 1];
    if (next === undefined) return;
    event.preventDefault();
    const nextIndex = items.findIndex(item => item.value === next);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
    if (next !== value) onChange(next);
  };

  return (
    <div
      className={cx('tabs', className, { stretch, sm: size === 'sm', md: size === 'md', underline: variant === 'underline' })}
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
            tabIndex={item.value === focusValue ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            onKeyDown={event => handleKeyDown(event, item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
