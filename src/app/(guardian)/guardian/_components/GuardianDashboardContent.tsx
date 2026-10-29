'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { WardSelectorTabs } from '@/components/connections/WardSelectorTabs';
import { guardianConnectionsQueryOptions, guardianDashboardQueryOptions } from '@/service/query/guardian';
import styles from './GuardianDashboardContent.module.css';

const cx = classNames.bind(styles);
const EMPTY_VALUE = '-';

const QUICK_LINKS = [
  { href: '/guardian/sos', icon: 'phone' as const, label: 'SOS 내역' },
  { href: '/guardian/hospital', icon: 'hospital' as const, label: '병원 예약' },
  { href: '/guardian/medication', icon: 'pill' as const, label: '약 관리' },
  { href: '/guardian/game', icon: 'game' as const, label: '게임 활동' },
  { href: '/guardian/wards', icon: 'users' as const, label: '연결된 가족' },
  { href: '/guardian/wards/register', icon: 'plus' as const, label: '가족 등록' },
];

export function GuardianDashboardContent() {
  const { data: connectionsResponse } = useQuery(guardianConnectionsQueryOptions);

  const activeConnections = useMemo(
    () => (Array.isArray(connectionsResponse?.data) ? connectionsResponse.data : [])
      .filter(connection => connection.status === 'ACTIVE')
      .sort((a, b) => getTime(b.connectedAt ?? b.createdAt) - getTime(a.connectedAt ?? a.createdAt)),
    [connectionsResponse],
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const selectedWard = activeConnections.find(connection => connection.id === selectedConnectionId) ?? activeConnections[0] ?? null;

  // 피보호자 칩 배지는 선택 상태와 무관하게 항상 전체 기준으로 보여야 해서 별도로 조회
  const { data: dashboardAll } = useQuery({
    ...guardianDashboardQueryOptions({}),
    enabled: connectionsResponse !== undefined,
  });
  const pendingByWard = new Map((dashboardAll?.wards ?? []).map(ward => [ward.wardId, ward.pendingCount]));

  const { data: dashboard } = useQuery({
    ...guardianDashboardQueryOptions({ wardId: selectedWard?.partnerUserId }),
    enabled: connectionsResponse !== undefined,
  });

  const isAnomalyUnavailable = dashboard?.unavailable.includes('anomalyDetection') ?? false;
  const anomaly = dashboard?.anomalyDetection;
  const pendingTotal = dashboard?.pendingActions.total;
  const needsReview = !isAnomalyUnavailable && (anomaly?.needsReviewCount ?? 0) > 0;

  if (activeConnections.length === 0) {
    return (
      <div className={cx('dashboardStack')}>
        <section className={cx('emptyHero')} aria-label="피보호자 없음">
          <div className={cx('emptyHeroIcon')}><Icon name="users" size={28} /></div>
          <div className={cx('emptyHeroText')}><strong>연결된 피보호자가 없습니다</strong><span>피보호자를 등록하면 상태 확인과 알림 관리가 시작됩니다.</span></div>
          <Link className={cx('emptyHeroButton')} href="/guardian/wards/register">피보호자 등록하기</Link>
        </section>
      </div>
    );
  }

  return (
    <div className={cx('dashboardStack')}>
      <div className={cx('dashboardToolbar')}>
        <WardSelectorTabs
          wards={activeConnections.map(connection => ({
            wardId: connection.partnerUserId,
            wardName: connection.partnerName || EMPTY_VALUE,
            profileImage: connection.partnerProfileImage,
            relation: connection.relation,
            badgeCount: pendingByWard.get(connection.partnerUserId),
          }))}
          selectedWardId={selectedWard?.partnerUserId}
          onSelect={wardId => setSelectedConnectionId(activeConnections.find(connection => connection.partnerUserId === wardId)?.id ?? null)}
        />
        <span className={cx('attentionBadge', { attention: !!pendingTotal })}>
          <Icon name={pendingTotal ? 'bell' : 'check'} size={18} />
          {pendingTotal == null ? '확인 중' : pendingTotal > 0 ? `확인이 필요한 일 ${pendingTotal}건` : '지금 확인할 일이 없어요'}
        </span>
      </div>
      <section className={cx('featureGrid')} aria-label="주요 기능">
        <Link
          href="/guardian/detection"
          className={cx('featureCard', 'detect', { danger: needsReview })}
          aria-label={needsReview ? `AI 이상감지, 확인 필요 ${anomaly?.needsReviewCount}건` : 'AI 이상감지'}
        >
          {needsReview && <DashboardPill tone="warn">확인 필요</DashboardPill>}
          <span className={cx('tileIcon')}><Icon name="flame" size={36} decorative /></span>
          <strong>AI 이상감지</strong>
        </Link>
        <Link href="/guardian/chatbot" className={cx('featureCard', 'chatbot')}>
          <span className={cx('chatIconWrap')}>
            <span className={cx('tileIcon')}><Icon name="messageCircle" size={36} decorative /></span>
            <span className={cx('calendarBadge')}><Icon name="calendar" size={15} decorative /></span>
          </span>
          <strong>AI 의료 챗봇</strong>
        </Link>
        <Link href="/guardian/emotion" className={cx('featureCard', 'mood')}>
          <span className={cx('moodIcon')}><MoodFace /></span>
          <strong>AI 기분 체크</strong>
        </Link>
      </section>
      <nav className={cx('quickLinks')} aria-label="빠른 이동">
        {QUICK_LINKS.slice(0, 4).map(link => <QuickLink key={link.href} {...link} />)}
        <span className={cx('quickDivider')} aria-hidden="true" />
        {QUICK_LINKS.slice(4).map(link => <QuickLink key={link.href} {...link} />)}
      </nav>
    </div>
  );
}

function QuickLink({ href, icon, label }: (typeof QUICK_LINKS)[number]) {
  return (
    <Link href={href} className={cx('quickLink')}>
      <Icon name={icon} size={18} decorative />
      {label}
    </Link>
  );
}

function DashboardPill({ children, tone }: { children: string; tone: 'warn' }) {
  return <span className={cx('statusPill', tone)}><Icon name="warning" size={13} decorative />{children}</span>;
}

function getTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function MoodFace() {
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <defs>
        <radialGradient id="guardian-dashboard-mood" cx="42%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ffe6cc" />
          <stop offset="70%" stopColor="#fdd3ae" />
          <stop offset="100%" stopColor="#f8c399" />
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="56.2" rx="14" ry="2.2" fill="#000" opacity=".08" />
      <circle cx="30" cy="33.5" r="20.5" fill="url(#guardian-dashboard-mood)" stroke="#ebae78" strokeWidth="1.3" />
      <ellipse cx="22.5" cy="22.8" rx="5.6" ry="3.2" transform="rotate(-28 22.5 22.8)" fill="#fff" opacity=".6" />
      <path d="M30 13.4V10.2" stroke="#6e9466" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M29.6 10.6Q25.6 7.4 21.8 9.6q3.2 3 7.8 1" fill="#a9d39b" />
      <path d="M30.4 10.6q4-3.2 7.8-1-3.2 3-7.8 1" fill="#a9d39b" />
      <ellipse cx="18.6" cy="37.2" rx="3.9" ry="2.6" fill="#ff9aa2" opacity=".8" />
      <ellipse cx="41.4" cy="37.2" rx="3.9" ry="2.6" fill="#ff9aa2" opacity=".8" />
      <path d="M21 33q3.5-4.4 7 0M32 33q3.5-4.4 7 0" fill="none" stroke="#2e2420" strokeLinecap="round" strokeWidth="2.1" />
      <path d="M25.2 37h9.6q-.6 6.2-4.8 6.2T25.2 37Z" fill="#3a2a22" />
      <path d="M27.2 41.6q2.8-2 5.6 0-1.2 1.6-2.8 1.6t-2.8-1.6Z" fill="#f07a86" />
    </svg>
  );
}
