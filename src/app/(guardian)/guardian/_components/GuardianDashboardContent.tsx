'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon, type IconName } from '@/components/Icon';
import { UserAvatar } from '@/components/UserAvatar';
import { getGuardianLiveCameras } from '@/service/api/guardian/camera';
import { guardianConnectionsQueryOptions } from '@/service/query/guardian';
import { guardianMedicationQueryOptions } from '@/service/query/guardian/medication';
import { myProfileQueryOptions } from '@/service/query/user';
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
  const { data: medicationSummaries = [] } = useQuery(guardianMedicationQueryOptions);
  const { data: liveCameras, isError: isLiveStreamsError } = useQuery({
    queryKey: ['dashboard-live-cameras'],
    queryFn: getGuardianLiveCameras,
    retry: false,
    staleTime: 15 * 1000,
  });

  const activeConnections = useMemo(
    () => (Array.isArray(connectionsResponse?.data) ? connectionsResponse.data : [])
      .filter(connection => connection.status === 'ACTIVE')
      .sort((a, b) => getTime(b.connectedAt ?? b.createdAt) - getTime(a.connectedAt ?? a.createdAt)),
    [connectionsResponse],
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const selectedWard = activeConnections.find(connection => connection.id === selectedConnectionId) ?? activeConnections[0] ?? null;

  const medication = medicationSummaries.find(summary => summary.wardId === selectedWard?.partnerUserId);
  const missedMedicationCount = medication ? Math.max(medication.totalCount - medication.takenCount, 0) : 0;
  const runningCameraCount = liveCameras?.filter(camera => camera.status === 'running').length ?? 0;
  const cards: DashboardCard[] = [
    {
      href: '/guardian/detection', icon: 'alert', kind: 'detect', title: '이상감지',
      main: isLiveStreamsError ? '상태를 확인할 수 없어요' : runningCameraCount > 0 ? '실시간 감지 진행 중' : '모니터링 대기 중',
      sub: isLiveStreamsError ? '카메라 연결 상태를 다시 확인해 주세요' : `분석 중인 카메라 ${runningCameraCount}대`,
      pill: isLiveStreamsError ? { tone: 'warn', label: '확인 필요' } : { tone: 'ok', label: '괜찮아요' },
    },
    {
      href: '/guardian/emotion', icon: 'heart', kind: 'mood', title: '오늘의 정서', main: '정서 상태 확인하기',
      sub: selectedWard ? `${selectedWard.partnerName} 님의 오늘 대화를 살펴보세요` : null,
      pill: { tone: 'ok', label: '살펴보기' },
    },
    {
      href: '/guardian/medication', icon: 'pill', kind: 'medication', title: '복약',
      main: medication ? `${medication.totalCount}번 중 ${medication.takenCount}번 드셨어요` : '등록된 복약 정보 없음',
      sub: medication ? (missedMedicationCount > 0 ? `오늘 미복용 ${missedMedicationCount}건` : '오늘 복약을 모두 확인했어요') : null,
      pill: medication ? (missedMedicationCount > 0 ? { tone: 'care', label: '미복용' } : { tone: 'ok', label: '잘 드셨어요' }) : undefined,
      highlighted: missedMedicationCount > 0 ? 'care' : undefined,
    },
    { href: '/guardian/sos', icon: 'phone', kind: 'sos', title: 'SOS', main: 'SOS 이력 확인하기', sub: selectedWard ? `${selectedWard.partnerName} 님의 긴급 호출 이력` : null },
    { href: '/guardian/hospital', icon: 'hospital', kind: 'hospital', title: '병원 예약', main: '병원 예약하기', sub: selectedWard ? `${selectedWard.partnerName} 님을 대신해 예약할 수 있어요` : null },
    { href: '/guardian/game', icon: 'game', kind: 'game', title: '게임·인지 활동', main: '게임 현황 확인하기', sub: selectedWard ? `${selectedWard.partnerName} 님의 인지 활동 기록` : null },
  ];
  const attentionCount = missedMedicationCount + (isLiveStreamsError ? 1 : 0);

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
            return (
              <button key={connection.id} className={cx('wardChip', { active: isSelected })} type="button" onClick={() => setSelectedConnectionId(connection.id)}>
                <UserAvatar imageUrl={connection.partnerProfileImage} size="w-32" />
                <span>{connection.partnerName || EMPTY_VALUE}</span><em>{connection.relation || '관계'}</em>
              </button>
            );
          })}
        </div>
        <span className={cx('attentionBadge', { attention: attentionCount > 0 })}>
          <Icon name={attentionCount > 0 ? 'bell' : 'alert'} size={20} />
          {attentionCount > 0 ? `확인이 필요한 일 ${attentionCount}건` : '지금 확인할 일이 없어요'}
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
