'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { UserAvatar } from '@/components/UserAvatar';
import { getLiveStreams } from '@/service/api/liveStream';
import { guardianConnectionsQueryOptions } from '@/service/query/connection';

import styles from './GuardianDashboardContent.module.css';

const cx = classNames.bind(styles);
const EMPTY_VALUE = '-';

const FEATURE_CARDS = [
  {
    href: '/guardian/detection',
    icon: 'alert' as const,
    title: '이상감지',
    summary: '이상 없음',
    description: '낙상·화재·흉기 실시간 감지',
    tone: 'rose',
  },
  {
    href: '/guardian/emotion',
    icon: 'heart' as const,
    title: '정서 상태 체크',
    summary: '기쁨',
    description: 'AI 말벗 + 표정 분석',
    tone: 'sky',
  },
  {
    href: '/guardian/chatbot',
    icon: 'messageCircle' as const,
    title: 'AI 의료 챗봇',
    summary: '대기 중',
    description: '건강 Q&A · 복약',
    tone: 'mint',
  },
  {
    href: '/guardian/hospital',
    icon: 'hospital' as const,
    title: '병원 예약하기',
    summary: '2건',
    description: '피보호자 대신 병원 예약',
    tone: 'amber',
  },
] as const;

export function GuardianDashboardContent() {
  const {
    data: connectionsResponse,
    isError: isConnectionsError,
    isLoading: isConnectionsLoading,
  } = useQuery(guardianConnectionsQueryOptions);
  const {
    data: liveStreams,
    isError: isLiveStreamsError,
    isLoading: isLiveStreamsLoading,
  } = useQuery({
    queryKey: ['dashboard-live-streams'],
    queryFn: getLiveStreams,
    retry: false,
    staleTime: 15 * 1000,
  });

  const connections = Array.isArray(connectionsResponse?.data) ? connectionsResponse.data : [];
  const activeConnections = connections.filter(connection => connection.status === 'ACTIVE');
  const hasLiveStreamData = !isLiveStreamsLoading && !isLiveStreamsError && Array.isArray(liveStreams);
  const analyzingStreamCount = liveStreams?.filter(session => session.is_analyzing).length ?? 0;

  const sortedActiveConnections = useMemo(
    () =>
      [...activeConnections].sort(
        (a, b) => getTime(b.connectedAt ?? b.createdAt) - getTime(a.connectedAt ?? a.createdAt),
      ),
    [activeConnections],
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const selectedActiveConnection =
    sortedActiveConnections.find(connection => connection.id === selectedConnectionId) ?? null;

  const heroName = selectedActiveConnection?.partnerName || '샘플 피보호자';
  const heroLabel = hasLiveStreamData
    ? analyzingStreamCount > 0
      ? '주의 · 감지 진행 중'
      : '안정 · 모니터링 중'
    : '안정 · 기쁨 표정 감지';
  const heroUpdatedAt = selectedActiveConnection
    ? formatClock(selectedActiveConnection.connectedAt ?? selectedActiveConnection.createdAt)
    : '오후 2:34';

  useEffect(() => {
    if (sortedActiveConnections.length === 0) {
      setSelectedConnectionId(null);
      return;
    }

    setSelectedConnectionId(currentId => {
      if (currentId && sortedActiveConnections.some(connection => connection.id === currentId)) {
        return currentId;
      }

      return sortedActiveConnections[0]?.id ?? null;
    });
  }, [sortedActiveConnections]);

  return (
    <div className={cx('dashboardStack')}>
      <section className={cx('wardSelectRow')} aria-label="피보호자 목록">
        <span className={cx('wardSelectLabel')}>피보호자</span>
        <div className={cx('wardRail')} role="list">
          {sortedActiveConnections.length > 0 ? (
            sortedActiveConnections.map(connection => {
              const isSelected = selectedActiveConnection?.id === connection.id;

              return (
                <button
                  key={connection.id}
                  className={cx('wardChip', { active: isSelected })}
                  type="button"
                  onClick={() => setSelectedConnectionId(connection.id)}
                >
                  <UserAvatar imageUrl={connection.partnerProfileImage} size="w-32" />
                  <span className={cx('wardChipName')}>{connection.partnerName || EMPTY_VALUE}</span>
                  <span className={cx('wardChipRelation')}>{connection.relation || '관계'}</span>
                </button>
              );
            })
          ) : (
            <div className={cx('wardChip', 'wardChipStatic')} aria-hidden="true">
              <UserAvatar size="w-32" />
              <span className={cx('wardChipName')}>샘플 피보호자</span>
              <span className={cx('wardChipRelation')}>미리보기</span>
            </div>
          )}
        </div>
      </section>

      <section className={cx('heroCard')}>
        <div className={cx('heroProfile')}>
          <UserAvatar imageUrl={selectedActiveConnection?.partnerProfileImage} size="w-60" />

          <div className={cx('heroText')}>
            <span className={cx('heroEyebrow')}>
              {selectedActiveConnection ? `${heroName} 님 오늘 상태` : '샘플 피보호자 님 오늘 상태'}
            </span>
            <strong>{heroLabel}</strong>
          </div>
        </div>

        <div className={cx('heroMeta')}>
          <span>마지막 업데이트</span>
          <strong>{heroUpdatedAt}</strong>
        </div>
      </section>

      <section className={cx('featureGrid')} aria-label="핵심 기능">
        {FEATURE_CARDS.map(card => (
          <Link key={card.href} href={card.href} className={cx('featureCard', card.tone)}>
            <span className={cx('featureIcon')}>
              <Icon name={card.icon} size={30} />
            </span>
            <strong>{card.title}</strong>
            <b>{card.summary}</b>
            <span>{card.description}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}

function getTime(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatClock(value?: string | null) {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;

  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
