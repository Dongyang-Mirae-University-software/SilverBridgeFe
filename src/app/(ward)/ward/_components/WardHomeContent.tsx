'use client';

import Link from 'next/link';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import styles from './WardHomeContent.module.css';

const cx = classNames.bind(styles);

const HOME_ACTIONS = [
  {
    href: '/ward/sos',
    icon: 'phone' as const,
    label: '긴급 전화',
    tone: 'warm',
    description: '즉시 도움을 요청합니다.',
  },
  {
    href: '/ward/medication',
    icon: 'pill' as const,
    label: '복약 알림',
    tone: 'mint',
    description: '복약 일정과 알림을 확인합니다.',
  },
  {
    href: '/ward/game',
    icon: 'brain' as const,
    label: '치매 예방 게임',
    tone: 'sand',
    description: '준비 중입니다.',
    // 임시: 아직 미공개라 카드는 보이되 클릭은 막는다. 공개할 때 이 줄만 지울 것.
    disabled: true,
  },
] as const;

export function WardHomeContent() {
  return (
    <div className={cx('homeGrid')}>
      {HOME_ACTIONS.map(action => {
        const content = (
          <>
            <span className={cx('iconWrap')}>
              <Icon name={action.icon} size={42} className={cx('icon')} />
            </span>
            <strong>{action.label}</strong>
            <span>{action.description}</span>
          </>
        );

        if ('disabled' in action && action.disabled) {
          return (
            <div key={action.href} className={cx('actionCard', action.tone, 'disabled')} aria-disabled="true">
              {content}
            </div>
          );
        }

        return (
          <Link key={action.href} className={cx('actionCard', action.tone)} href={action.href} aria-label={action.label}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
