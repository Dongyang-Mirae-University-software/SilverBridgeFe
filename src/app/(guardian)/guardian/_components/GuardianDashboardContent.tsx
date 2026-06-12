'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
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
  const activeStreamCount = liveStreams?.length ?? 0;
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

  const trendSeries = useMemo(
    () => buildTrendSeries(activeStreamCount, analyzingStreamCount, hasLiveStreamData),
    [activeStreamCount, analyzingStreamCount, hasLiveStreamData],
  );
  const distribution = useMemo(
    () => buildDistribution(activeStreamCount, analyzingStreamCount, hasLiveStreamData),
    [activeStreamCount, analyzingStreamCount, hasLiveStreamData],
  );
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
                  <span className={cx('wardChipInitial')}>{getInitial(connection.partnerName)}</span>
                  <span className={cx('wardChipName')}>{connection.partnerName || EMPTY_VALUE}</span>
                  <span className={cx('wardChipRelation')}>{connection.relation || '관계'}</span>
                </button>
              );
            })
          ) : (
            <div className={cx('wardChip', 'wardChipStatic')} aria-hidden="true">
              <span className={cx('wardChipInitial')}>샘</span>
              <span className={cx('wardChipName')}>샘플 피보호자</span>
              <span className={cx('wardChipRelation')}>미리보기</span>
            </div>
          )}
        </div>
      </section>

      <section className={cx('heroCard')}>
        <div className={cx('heroProfile')}>
          <div className={cx('heroAvatar')}>
            {selectedActiveConnection?.partnerProfileImage ? (
              <img alt="" src={selectedActiveConnection.partnerProfileImage} />
            ) : (
              <span>{getInitial(heroName)}</span>
            )}
          </div>

          <div className={cx('heroText')}>
            <span className={cx('heroEyebrow')}>{selectedActiveConnection ? `${heroName} 님 오늘 상태` : '샘플 피보호자 님 오늘 상태'}</span>
            <strong>{heroLabel}</strong>
          </div>
        </div>

        <div className={cx('heroMeta')}>
          <span>마지막 업데이트</span>
          <strong>{heroUpdatedAt}</strong>
        </div>
      </section>

      <section className={cx('insightGrid')}>
        <article className={cx('panelCard', 'trendCard')}>
          <div className={cx('cardHeader')}>
            <h3>이상감지 추이</h3>
          </div>
          <Sparkline series={trendSeries} />
        </article>

        <article className={cx('panelCard', 'distributionCard')}>
          <div className={cx('cardHeader')}>
            <h3>카테고리 분포</h3>
          </div>

          <div className={cx('donutRow')}>
            <div className={cx('donut')} style={{ background: buildDonutBackground(distribution) }}>
              <div className={cx('donutInner')}>
                <strong>{distribution.reduce((sum, item) => sum + item.value, 0).toLocaleString('ko-KR')}</strong>
                <span>총</span>
              </div>
            </div>

            <div className={cx('donutList')}>
              {distribution.map(item => (
                <div key={item.label} className={cx('donutItem')}>
                  <span>
                    <i className={cx('donutDot', item.tone)} />
                    {item.label}
                  </span>
                  <strong>{item.value}%</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
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

function getInitial(value?: string | null) {
  const initial = value?.trim()?.[0];
  return initial ? initial.toUpperCase() : '?';
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

function buildTrendSeries(activeCount: number, analyzingCount: number, hasLiveStreamData: boolean) {
  const base = hasLiveStreamData ? [22, 28, 26, 38, 36, 45, 49, 42, 54, 50, 58, 51] : [18, 24, 22, 30, 28, 37, 39, 35, 42, 38, 44, 40];
  const lineA = base.map((value, index) => value + Math.min(activeCount * 2, 10) + (index % 4 === 0 ? analyzingCount * 2 : 0));
  const lineB = base.map((value, index) => value - 4 + Math.min(activeCount, 6) + (index % 3 === 0 ? analyzingCount : 0));
  const lineC = base.map((value, index) => value - 8 + Math.min(activeCount, 4) + (index % 5 === 0 ? analyzingCount : 0));

  return [
    { values: lineA, color: '#d84b3f' },
    { values: lineB, color: '#d59a2a' },
    { values: lineC, color: '#8d4a7a' },
  ];
}

function buildDistribution(activeCount: number, analyzingCount: number, hasLiveStreamData: boolean) {
  if (!hasLiveStreamData) {
    return [
      { label: '낙상', value: 50, tone: 'danger' as const },
      { label: '화재', value: 30, tone: 'watch' as const },
      { label: '흉기', value: 20, tone: 'safe' as const },
    ];
  }

  const fall = Math.max(30, 50 + analyzingCount * 2 - activeCount * 2);
  const fire = Math.min(40, 28 + activeCount * 2);
  const knife = Math.max(10, 100 - fall - fire);

  return [
    { label: '낙상', value: fall, tone: 'danger' as const },
    { label: '화재', value: fire, tone: 'watch' as const },
    { label: '흉기', value: knife, tone: 'safe' as const },
  ];
}

function buildDonutBackground(distribution: Array<{ tone: 'danger' | 'watch' | 'safe'; value: number }>) {
  const colors = {
    danger: '#c95647',
    watch: '#cf9831',
    safe: '#8b4a7b',
  };
  let start = 0;

  return `conic-gradient(${distribution
    .map(item => {
      const end = start + item.value;
      const segment = `${colors[item.tone]} ${start}% ${end}%`;
      start = end;
      return segment;
    })
    .join(', ')})`;
}

function Sparkline({ series }: { series: Array<{ values: number[]; color: string }> }) {
  const width = 100;
  const height = 100;

  return (
    <svg className={cx('sparkline')} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {series.map((line, index) => {
        const max = Math.max(...line.values, 100);
        const min = Math.min(...line.values, 0);
        const range = Math.max(max - min, 1);
        const points = line.values
          .map((value, pointIndex) => {
            const x = (pointIndex / Math.max(line.values.length - 1, 1)) * width;
            const y = height - ((value - min) / range) * height;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(' ');

        return <polyline key={index} className={cx('sparklineLine')} points={points} style={{ stroke: line.color }} />;
      })}
      <polyline className={cx('sparklineGrid')} points={`0,88 100,88`} />
    </svg>
  );
}
