'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { getLiveStreams } from '@/service/api/liveStream';
import { IConnectionItem } from '@/service/interface/connection';
import { guardianConnectionsQueryOptions } from '@/service/query/connection';

import styles from './GuardianDashboardContent.module.css';

const cx = classNames.bind(styles);
const EMPTY_VALUE = '-';

const FEATURE_CARDS = [
  {
    href: '/guardian/detection',
    icon: 'monitor' as const,
    title: '이상 감지',
    description: '실시간 송출과 감지 결과를 확인합니다.',
    tone: 'blue',
  },
  {
    href: '/guardian/chatbot',
    icon: 'brain' as const,
    title: 'AI 의료',
    description: '상담 기록과 응답 흐름을 이어봅니다.',
    tone: 'green',
  },
  {
    href: '/guardian/notices',
    icon: 'warning' as const,
    title: '공지사항',
    description: '운영 안내와 최신 공지를 확인합니다.',
    tone: 'amber',
  },
  {
    href: '/guardian/wards',
    icon: 'handshake' as const,
    title: '피보호자 관리',
    description: '연결과 요청을 한곳에서 관리합니다.',
    tone: 'rose',
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
  const hasConnectionData = !isConnectionsLoading && !isConnectionsError && Array.isArray(connectionsResponse?.data);
  const hasLiveStreamData = !isLiveStreamsLoading && !isLiveStreamsError && Array.isArray(liveStreams);
  const activeConnections = connections.filter(connection => connection.status === 'ACTIVE');
  const pendingConnections = connections.filter(connection => connection.status === 'PENDING');
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
  const trendValues = useMemo(
    () => buildTrendValues(activeStreamCount, analyzingStreamCount, hasLiveStreamData),
    [activeStreamCount, analyzingStreamCount, hasLiveStreamData],
  );
  const distribution = useMemo(
    () => buildDistribution(activeStreamCount, analyzingStreamCount, hasLiveStreamData),
    [activeStreamCount, analyzingStreamCount, hasLiveStreamData],
  );

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

  const stats = [
    {
      label: '연결된 피보호자',
      state: hasConnectionData ? 'ACTIVE 상태' : '샘플 데이터',
      value: formatCount(activeConnections.length, hasConnectionData, '명'),
    },
    {
      label: '요청 대기',
      state: hasConnectionData ? 'PENDING 상태' : '샘플 데이터',
      value: formatCount(pendingConnections.length, hasConnectionData, '건'),
    },
    {
      label: '실시간 송출',
      state: hasLiveStreamData ? '현재 세션' : '샘플 데이터',
      value: formatCount(activeStreamCount, hasLiveStreamData, '건'),
    },
    {
      label: 'AI 분석 중',
      state: hasLiveStreamData ? '실시간 감지' : '샘플 데이터',
      value: formatCount(analyzingStreamCount, hasLiveStreamData, '건'),
    },
  ];

  return (
    <div className={cx('dashboardStack')}>
      <section className={cx('summaryCard')}>
        <div className={cx('summaryHeader')}>
          <div className={cx('summaryHeading')}>
            <span className={cx('eyebrow')}>오늘의 대시보드</span>
            <h2>콘텐츠 상태를 한눈에 확인하세요.</h2>
            <p>실시간 송출, 이상 감지, 공지와 연결 현황을 묶어서 보여주는 요약 화면입니다.</p>
          </div>
          <div className={cx('summaryBadge')}>
            <span>{hasConnectionData ? '선택 대상' : '샘플 데이터'}</span>
            <strong>{selectedActiveConnection?.partnerName || '샘플 피보호자'}</strong>
            <small>
              {selectedActiveConnection
                ? `${selectedActiveConnection.relation || '관계 없음'} · ${getStatusLabel(selectedActiveConnection.status)}`
                : '연결된 피보호자가 없으면 미리보기 데이터를 보여줍니다.'}
            </small>
          </div>
        </div>

        <div className={cx('wardRailWrap')}>
          <div className={cx('sectionLabelRow')}>
            <span className={cx('sectionLabel')}>피보호자 선택</span>
            <span className={cx('sectionLabelHint')}>{sortedActiveConnections.length > 0 ? `${sortedActiveConnections.length}명` : '샘플 1명'}</span>
          </div>

          <div className={cx('wardRail')} role="list" aria-label="연결된 피보호자 목록">
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
                    <div className={cx('wardAvatar')}>
                      <span>{getInitial(connection.partnerName)}</span>
                    </div>
                    <div className={cx('wardInfo')}>
                      <div className={cx('wardTitleRow')}>
                        <strong>{connection.partnerName || EMPTY_VALUE}</strong>
                        <span className={cx('wardRelation')}>{connection.relation || '관계 없음'}</span>
                      </div>
                      <span className={cx('wardSubText')}>
                        {formatLongDate(connection.connectedAt ?? connection.createdAt)}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className={cx('wardChip', 'wardChipGhost')} aria-hidden="true">
                <div className={cx('wardAvatar')}>
                  <span>샘</span>
                </div>
                <div className={cx('wardInfo')}>
                  <div className={cx('wardTitleRow')}>
                    <strong>샘플 피보호자</strong>
                    <span className={cx('wardRelation')}>미리보기</span>
                  </div>
                  <span className={cx('wardSubText')}>연결 데이터가 없을 때 보이는 예시입니다.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={cx('selectedSummary')}>
          <div>
            <span>{selectedActiveConnection ? '선택된 피보호자' : '미리보기 상태'}</span>
            <strong>{selectedActiveConnection?.relation || '서비스 대시보드'}</strong>
            <p>
              {selectedActiveConnection
                ? `${selectedActiveConnection.partnerName || EMPTY_VALUE} · ${formatLongDate(selectedActiveConnection.connectedAt ?? selectedActiveConnection.createdAt)}`
                : '콘텐츠, 송출, 감지 정보를 더 빠르게 확인합니다.'}
            </p>
          </div>
          <div className={cx('selectedMeta')}>
            <strong>{selectedActiveConnection ? getStatusLabel(selectedActiveConnection.status) : '샘플'}</strong>
            <span>{selectedActiveConnection ? '실시간 연결됨' : '예시 콘텐츠 표시 중'}</span>
          </div>
        </div>

        <div className={cx('statGrid')}>
          {stats.map(stat => (
            <div key={stat.label} className={cx('statCard')}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.state}</small>
            </div>
          ))}
        </div>
      </section>

      <section className={cx('insightGrid')}>
        <article className={cx('panelCard', 'trendCard')}>
          <div className={cx('cardHeader')}>
            <div>
              <span className={cx('eyebrow')}>감지 추이</span>
              <h3>최근 송출 신호</h3>
            </div>
            <span className={cx('cardMeta')}>{hasLiveStreamData ? `${activeStreamCount}개 세션` : '샘플 데이터'}</span>
          </div>

          <div className={cx('sparklineWrap')}>
            <Sparkline values={trendValues} />
          </div>

          <ul className={cx('legend')}>
            <li>
              <span className={cx('legendDot', 'safe')} />
              안전
            </li>
            <li>
              <span className={cx('legendDot', 'watch')} />
              주의
            </li>
            <li>
              <span className={cx('legendDot', 'danger')} />
              위험
            </li>
          </ul>
        </article>

        <article className={cx('panelCard', 'distributionCard')}>
          <div className={cx('cardHeader')}>
            <div>
              <span className={cx('eyebrow')}>콘텐츠 분포</span>
              <h3>이상 신호 비율</h3>
            </div>
            <span className={cx('cardMeta')}>{hasLiveStreamData ? '실시간 반영' : '샘플 분포'}</span>
          </div>

          <div className={cx('donutRow')}>
            <div className={cx('donut')} style={{ background: buildDonutBackground(distribution) }}>
              <div className={cx('donutInner')}>
                <strong>{distribution.reduce((sum, item) => sum + item.value, 0)}</strong>
                <span>분포 지표</span>
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

      <section className={cx('featureGrid')} aria-label="핵심 기능 바로가기">
        {FEATURE_CARDS.map(card => (
          <Link key={card.href} href={card.href} className={cx('featureCard', card.tone)}>
            <span className={cx('featureIcon')}>
              <Icon name={card.icon} size={30} />
            </span>
            <strong>{card.title}</strong>
            <span>{card.description}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}

function formatCount(count: number, hasData: boolean, suffix: string) {
  return hasData ? `${count}${suffix}` : `${EMPTY_VALUE}${suffix}`;
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

function formatLongDate(value?: string | null) {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

function getStatusLabel(status: IConnectionItem['status']) {
  switch (status) {
    case 'ACTIVE':
      return '연결됨';
    case 'CANCELLED':
      return '취소됨';
    case 'REFUSED':
      return '거절됨';
    case 'DISCONNECTED':
      return '연결 해제됨';
    default:
      return '수락 대기';
  }
}

function buildTrendValues(activeCount: number, analyzingCount: number, hasLiveStreamData: boolean) {
  const base = hasLiveStreamData ? [28, 34, 30, 42, 39, 53, 58, 49, 62, 57, 66, 60] : [22, 27, 25, 31, 29, 35, 37, 34, 40, 39, 43, 41];
  const streamBoost = Math.min(activeCount * 2, 12);
  const analysisBoost = Math.min(analyzingCount * 4, 16);

  return base.map((value, index) => Math.max(12, Math.min(88, value + streamBoost + (index % 3 === 0 ? analysisBoost : 0))));
}

function buildDistribution(activeCount: number, analyzingCount: number, hasLiveStreamData: boolean) {
  if (!hasLiveStreamData) {
    return [
      { label: '안전', value: 62, tone: 'safe' as const },
      { label: '주의', value: 24, tone: 'watch' as const },
      { label: '위험', value: 14, tone: 'danger' as const },
    ];
  }

  const safe = Math.max(34, 64 - activeCount * 4 - analyzingCount * 3);
  const watch = Math.min(36, 22 + activeCount * 2 + analyzingCount * 3);
  const danger = Math.max(8, 100 - safe - watch);

  return [
    { label: '안전', value: safe, tone: 'safe' as const },
    { label: '주의', value: watch, tone: 'watch' as const },
    { label: '위험', value: danger, tone: 'danger' as const },
  ];
}

function buildDonutBackground(distribution: Array<{ tone: 'safe' | 'watch' | 'danger'; value: number }>) {
  const colors = {
    safe: 'var(--guardian-brand)',
    watch: '#d6a94f',
    danger: '#d95c5c',
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

function Sparkline({ values }: { values: number[] }) {
  const width = 100;
  const height = 100;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg className={cx('sparkline')} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sparklineStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--sb-brand)" />
          <stop offset="100%" stopColor="var(--guardian-brand)" />
        </linearGradient>
      </defs>
      <polyline className={cx('sparklineGrid')} points={`0,90 100,90`} />
      <polyline className={cx('sparklineLine')} points={points} />
    </svg>
  );
}
