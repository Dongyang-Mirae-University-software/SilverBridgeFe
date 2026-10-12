'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon, type IconName } from '@/components/Icon';
import { UserAvatar } from '@/components/UserAvatar';
import { guardianConnectionsQueryOptions, guardianDashboardQueryOptions } from '@/service/query/guardian';
import { myProfileQueryOptions } from '@/service/query/user';
import { formatDateTime } from '@/utils/format/date';
import { formatDoseTime, getMedicationTimeSlotLabel } from '@/utils/format/medication';
import { getUserProfileData } from '@/utils/auth/userProfile';
import styles from './GuardianDashboardContent.module.css';

const cx = classNames.bind(styles);
const EMPTY_VALUE = '-';

type DashboardCard = {
  href: string;
  icon: IconName;
  kind: 'detect' | 'mood' | 'medication' | 'sos' | 'hospital' | 'game';
  title: string;
  main: string;
  sub?: string | null;
  pill?: { tone: 'ok' | 'care' | 'warn'; label: string };
  highlighted?: 'danger' | 'care';
};

export function GuardianDashboardContent() {
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
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
  const isSosUnavailable = dashboard?.unavailable.includes('sos') ?? false;
  const isMedicationUnavailable = dashboard?.unavailable.includes('medication') ?? false;

  const anomaly = dashboard?.anomalyDetection;
  const sos = dashboard?.sos;
  const medication = dashboard?.medication;
  const mostUrgent = medication?.mostUrgent;

  const cards: DashboardCard[] = [
    {
      href: '/guardian/detection', icon: 'alert', kind: 'detect', title: '이상감지',
      main: isAnomalyUnavailable
        ? '확인 중'
        : anomaly?.latest
          ? `${anomaly.latest.cameraLabel ?? '카메라'}에서 ${anomaly.latest.detectedTypeLabel} 의심 감지`
          : '확인할 이상 감지가 없어요',
      sub: isAnomalyUnavailable
        ? '잠시 후 다시 시도해 주세요'
        : anomaly?.needsReviewCount
          ? `확인 필요 ${anomaly.needsReviewCount}건`
          : null,
      pill: isAnomalyUnavailable
        ? undefined
        : anomaly?.needsReviewCount
          ? { tone: 'warn', label: '확인 필요' }
          : { tone: 'ok', label: '괜찮아요' },
      highlighted: !isAnomalyUnavailable && (anomaly?.needsReviewCount ?? 0) > 0 ? 'danger' : undefined,
    },
    {
      href: '/guardian/emotion', icon: 'heart', kind: 'mood', title: '오늘의 정서', main: '정서 상태 확인하기',
      sub: selectedWard ? `${selectedWard.partnerName} 님의 오늘 대화를 살펴보세요` : null,
      pill: { tone: 'ok', label: '살펴보기' },
    },
    {
      href: '/guardian/medication', icon: 'pill', kind: 'medication', title: '복약',
      main: isMedicationUnavailable
        ? '확인 중'
        : mostUrgent
          ? `${getMedicationTimeSlotLabel(mostUrgent.timeSlot)} ${mostUrgent.name} (${formatDoseTime(mostUrgent.doseTime)})`
          : '체크되지 않은 약이 없어요',
      sub: isMedicationUnavailable
        ? '잠시 후 다시 시도해 주세요'
        : mostUrgent
          ? '체크되지 않았습니다'
          : '오늘 복약을 모두 확인했어요',
      pill: isMedicationUnavailable ? undefined : mostUrgent ? { tone: 'care', label: '미체크' } : { tone: 'ok', label: '잘 드셨어요' },
      highlighted: !isMedicationUnavailable && mostUrgent ? 'care' : undefined,
    },
    {
      href: '/guardian/sos', icon: 'phone', kind: 'sos', title: 'SOS',
      main: isSosUnavailable
        ? '확인 중'
        : sos?.latest
          ? `최근 ${formatDateTime(sos.latest.triggeredAt)}`
          : '이번 달 호출 이력이 없어요',
      sub: isSosUnavailable ? '잠시 후 다시 시도해 주세요' : sos?.latest?.location ?? null,
      pill: isSosUnavailable || !sos?.thisMonthCount ? undefined : { tone: 'warn', label: `이번 달 ${sos.thisMonthCount}건` },
    },
    { href: '/guardian/hospital', icon: 'hospital', kind: 'hospital', title: '병원 예약', main: '병원 예약하기', sub: selectedWard ? `${selectedWard.partnerName} 님을 대신해 예약할 수 있어요` : null },
    { href: '/guardian/game', icon: 'game', kind: 'game', title: '게임·인지 활동', main: '게임 현황 확인하기', sub: selectedWard ? `${selectedWard.partnerName} 님의 인지 활동 기록` : null },
  ];
  const pendingTotal = dashboard?.pendingActions.total;

  if (activeConnections.length === 0) {
    return (
      <div className={cx('dashboardStack')}>
        <DashboardHeading guardianName={profile?.name} />
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
      <DashboardHeading guardianName={profile?.name} />
      <div className={cx('dashboardToolbar')}>
        <div className={cx('wardRail')} role="list" aria-label="피보호자 선택">
          {activeConnections.map(connection => {
            const isSelected = selectedWard?.id === connection.id;
            const pendingCount = pendingByWard.get(connection.partnerUserId);
            return (
              <button key={connection.id} className={cx('wardChip', { active: isSelected })} type="button" onClick={() => setSelectedConnectionId(connection.id)}>
                <UserAvatar imageUrl={connection.partnerProfileImage} size="w-32" />
                <span>{connection.partnerName || EMPTY_VALUE}</span><em>{connection.relation || '관계'}</em>
                {!!pendingCount && <i className={cx('wardChipBadge')}>{pendingCount}</i>}
              </button>
            );
          })}
        </div>
        <span className={cx('attentionBadge', { attention: !!pendingTotal })}>
          <Icon name={pendingTotal ? 'bell' : 'alert'} size={20} />
          {pendingTotal == null ? '확인 중' : pendingTotal > 0 ? `확인이 필요한 일 ${pendingTotal}건` : '지금 확인할 일이 없어요'}
        </span>
      </div>
      <section className={cx('featureGrid')} aria-label="피보호자 현황">
        {cards.map(card => (
          <Link key={card.href} href={card.href} className={cx('featureCard', card.kind, card.highlighted)}>
            <div className={cx('cardTop')}>
              <span className={cx('featureIcon')}><Icon name={card.icon} size={18} /></span>
              <strong>{card.title}</strong>
              {card.pill && <StatusPill {...card.pill} />}
            </div>
            <div className={cx('cardBody')}><b>{card.main}</b>{card.sub && <span>{card.sub}</span>}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}

function DashboardHeading({ guardianName }: { guardianName?: string }) {
  return <header className={cx('heading')}><h1>대시보드</h1><p>{formatDashboardDate()} · 보호자 {guardianName || EMPTY_VALUE} 님</p></header>;
}

function StatusPill({ tone, label }: { tone: 'ok' | 'care' | 'warn'; label: string }) {
  return <span className={cx('statusPill', tone)}><Icon name={tone === 'ok' ? 'alert' : tone === 'care' ? 'refresh' : 'warning'} size={13} />{label}</span>;
}

function getTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function formatDashboardDate() {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
}
