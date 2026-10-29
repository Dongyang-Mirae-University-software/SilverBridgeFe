'use client';

import Link from 'next/link';
import classNames from 'classnames/bind';

import { Icon, type IconName } from '@/components/Icon';
import styles from './WardHomeContent.module.css';

const cx = classNames.bind(styles);

const HOME_ACTIONS: Array<{
  href: string;
  icon: IconName;
  label: string;
  tone: 'sos' | 'chatbot' | 'game' | 'camera' | 'hospital' | 'medication';
  disabled?: boolean;
}> = [
  { href: '/ward/sos', icon: 'phone', label: '긴급 전화', tone: 'sos' },
  { href: '/ward/chatbot', icon: 'messageCircle', label: 'AI 의료', tone: 'chatbot' },
  // 게임은 아직 정식 공개 전이다. 카드 디자인은 유지하되 기존처럼 이동은 막는다.
  { href: '/ward/game', icon: 'puzzle', label: '치매 예방 게임', tone: 'game', disabled: true },
  { href: '/ward/camera', icon: 'camera', label: '카메라 등록', tone: 'camera' },
  { href: '/ward/hospital', icon: 'hospital', label: '병원 가는 날', tone: 'hospital' },
  { href: '/ward/medication', icon: 'pill', label: '오늘 먹을 약', tone: 'medication' },
];

export function WardHomeContent() {
  return (
    <div className={cx('homeGrid')}>
      {HOME_ACTIONS.map(action => {
        const content = (
          <>
            <span className={cx('iconWrap')}><Icon name={action.icon} size={48} /></span>
            <strong>{action.label}</strong>
          </>
        );

        if (action.disabled) {
          return <div key={action.href} className={cx('actionCard', action.tone, 'disabled')} aria-disabled="true">{content}</div>;
        }

        return <Link key={action.href} className={cx('actionCard', action.tone)} href={action.href}>{content}</Link>;
      })}
    </div>
  );
}
