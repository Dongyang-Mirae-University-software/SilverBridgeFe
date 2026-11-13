'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon, type IconName } from '@/components/Icon';
import { wardCompanionTodayQueryOptions } from '@/service/query/ward/companion';
import { openCompanionSlot } from '@/utils/companion/companionOpen';
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
  { href: '/ward/game', icon: 'puzzle', label: '치매 예방 게임', tone: 'game' },
  { href: '/ward/camera', icon: 'camera', label: '카메라 등록', tone: 'camera' },
  { href: '/ward/hospital', icon: 'hospital', label: '병원 가는 날', tone: 'hospital' },
  { href: '/ward/medication', icon: 'pill', label: '오늘 먹을 약', tone: 'medication' },
];

export function WardHomeContent() {
  // 안부 말벗은 대화를 열 수 있을 때(창 안 + 아직 열 수 있거나 하던 대화가 있음 - openCompanionSlot)에만 맨 위 카드로 보인다 - 시간표·대기 안내는 피보호자에게 보이지 않는다
  // (2026-11-11 사용자 결정). 시간대가 바뀌면 카드가 생기거나 사라지도록 1분마다 다시 받는다. 오류면 카드 없음.
  const { data: companionToday } = useQuery({ ...wardCompanionTodayQueryOptions, refetchInterval: 60_000 });
  const companionOpen = openCompanionSlot(companionToday) !== null;

  return (
    <div className={cx('homeGrid', { withCompanion: companionOpen })}>
      {/* 화면 제목은 시안에 없어 보이지 않게 두고, 화면 읽기 프로그램·자동 점검이 찾을 수 있게 h1만 둔다 */}
      <h1 className={cx('srOnly')}>피보호자 홈</h1>
      {companionOpen && (
        <Link className={cx('companionCard')} href="/ward/companion">
          <span className={cx('companionIcon')}><Icon name="heart" size={40} decorative /></span>
          <strong>지금 안부 대화할 시간이에요</strong>
          <span className={cx('companionButton')}>대화하기</span>
        </Link>
      )}
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
