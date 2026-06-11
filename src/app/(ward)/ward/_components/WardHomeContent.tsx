'use client';

import Link from 'next/link';
import classNames from 'classnames/bind';

import BrainIcon from '@/assets/icons/BrainIcon';
import PhoneIcon from '@/assets/icons/PhoneIcon';
import PillIcon from '@/assets/icons/PillIcon';
import styles from './WardHomeContent.module.css';

const cx = classNames.bind(styles);

const HOME_ACTIONS = [
  {
    href: '/ward/sos',
    icon: PhoneIcon,
    label: '긴급 전화',
    tone: 'warm',
    description: '즉시 도움을 요청합니다.',
  },
  {
    href: '/ward/medication',
    icon: PillIcon,
    label: '복약 알림',
    tone: 'mint',
    description: '복약 일정과 알림을 확인합니다.',
  },
  {
    href: '/ward/game',
    icon: BrainIcon,
    label: '치매 예방 게임',
    tone: 'sand',
    description: '인지 건강을 위한 활동입니다.',
  },
] as const;

export function WardHomeContent() {
  return (
    <div className={cx('homeGrid')}>
      {HOME_ACTIONS.map(action => {
        const Icon = action.icon;
        return (
          <Link key={action.href} className={cx('actionCard', action.tone)} href={action.href} aria-label={action.label}>
            <span className={cx('iconWrap')}>
              <Icon className={cx('icon')} />
            </span>
            <strong>{action.label}</strong>
            <span>{action.description}</span>
          </Link>
        );
      })}
    </div>
  );
}
