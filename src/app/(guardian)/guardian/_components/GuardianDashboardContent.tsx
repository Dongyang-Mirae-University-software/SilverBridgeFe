'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { MoodFace } from '@/components/MoodFace';
import { WardSelectorTabs } from '@/components/connections/WardSelectorTabs';
import { guardianConnectionsQueryOptions, guardianDashboardQueryOptions } from '@/service/query/guardian';
import { setSelectedWardId, useSelectedWard } from '@/store/selectedWardStore';
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
  const {
    data: connectionsResponse,
    isLoading: isConnectionsLoading,
    isError: isConnectionsError,
    refetch: refetchConnections,
  } = useQuery(guardianConnectionsQueryOptions);

  const activeConnections = useMemo(
    () => (Array.isArray(connectionsResponse?.data) ? connectionsResponse.data : [])
      .filter(connection => connection.status === 'ACTIVE')
      .sort((a, b) => getTime(b.connectedAt ?? b.createdAt) - getTime(a.connectedAt ?? a.createdAt)),
    [connectionsResponse],
  );
  const selectedWard = useSelectedWard(activeConnections, connection => connection.partnerUserId);

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
  // 확인 필요 건수가 있으면 그 칸에 테두리를 둔다(v13.0 시안). 이상감지는 두 값 중 하나라도 있으면 켠다
  const anomalyCount = anomaly?.needsReviewCount || dashboard?.pendingActions.anomaly || 0;
  const needsReview = !isAnomalyUnavailable && anomalyCount > 0;
  const isSosUnavailable = dashboard?.unavailable.includes('sos') ?? false;
  const sosCount = isSosUnavailable ? 0 : (dashboard?.sos.thisMonthCount ?? 0);
  const isMedicationUnavailable = dashboard?.unavailable.includes('medication') ?? false;
  const medicationCount = isMedicationUnavailable ? 0 : (dashboard?.medication.uncheckedCount ?? 0);
  // 이번 달 SOS가 있으면 SOS 내역, 아직 확인 안 한 복약이 있으면 약 관리 칩을 시안의 강조 칩으로 그린다
  const chipAlert = (href: string): ChipAlert | undefined => {
    if (href === '/guardian/sos' && sosCount > 0) return { label: `이번 달 SOS ${sosCount}건` };
    if (href === '/guardian/medication' && medicationCount > 0) return { label: `확인 안 한 복약 ${medicationCount}건` };
    return undefined;
  };
  // 이상감지 카드는 확인할 이상감지가 있거나 이번 달 SOS가 있으면 테두리·확인 필요 배지를 둔다
  const detectAlert = needsReview || sosCount > 0;
  const detectLabel = [needsReview && `확인 필요 ${anomalyCount}건`, sosCount > 0 && `이번 달 SOS ${sosCount}건`].filter(Boolean).join(', ');

  // 화면 제목은 시안에 없어 보이지 않게 두고, 화면 읽기 프로그램·자동 점검이 찾을 수 있게 h1만 둔다
  const pageHeading = <h1 className={cx('srOnly')}>보호자 대시보드</h1>;

  // 목록을 받기 전·실패했을 때 "연결된 피보호자가 없습니다"로 보이지 않게 따로 안내한다
  if (isConnectionsLoading) {
    return (
      <div className={cx('dashboardStack')}>
        {pageHeading}
        <p className={cx('stateCard')} role="status">피보호자 정보를 불러오는 중이에요.</p>
      </div>
    );
  }

  if (isConnectionsError && !connectionsResponse) {
    return (
      <div className={cx('dashboardStack')}>
        {pageHeading}
        <div className={cx('stateCard')} role="alert">
          <p>피보호자 정보를 불러오지 못했어요.</p>
          <button className={cx('emptyHeroButton')} type="button" onClick={() => void refetchConnections()}>
            다시 불러오기
          </button>
        </div>
      </div>
    );
  }

  if (activeConnections.length === 0) {
    return (
      <div className={cx('dashboardStack')}>
        {pageHeading}
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
      {pageHeading}
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
          onSelect={setSelectedWardId}
        />
        <span className={cx('attentionBadge', { attention: !!pendingTotal })}>
          <Icon name={pendingTotal ? 'bell' : 'check'} size={18} />
          {pendingTotal == null ? '확인 중' : pendingTotal > 0 ? `확인이 필요한 일 ${pendingTotal}건` : '지금 확인할 일이 없어요'}
        </span>
      </div>
      <section className={cx('featureGrid')} aria-label="주요 기능">
        <Link
          href="/guardian/detection"
          className={cx('featureCard', 'detect', { danger: detectAlert })}
          aria-label={detectAlert ? `AI 이상감지, ${detectLabel}` : 'AI 이상감지'}
        >
          {detectAlert && <DashboardPill tone="warn">확인 필요</DashboardPill>}
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
        {QUICK_LINKS.slice(0, 4).map(link => (
          <QuickLink key={link.href} {...link} alert={chipAlert(link.href)} />
        ))}
        <span className={cx('quickDivider')} aria-hidden="true" />
        {QUICK_LINKS.slice(4).map(link => <QuickLink key={link.href} {...link} />)}
      </nav>
    </div>
  );
}

type ChipAlert = { label: string };

function QuickLink({ href, icon, label, alert }: (typeof QUICK_LINKS)[number] & { alert?: ChipAlert }) {
  return (
    <Link href={href} className={cx('quickLink', { warn: alert })} aria-label={alert ? `${label}, ${alert.label}` : undefined}>
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
