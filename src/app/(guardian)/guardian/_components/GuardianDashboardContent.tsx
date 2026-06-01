'use client';

import { useQuery } from '@tanstack/react-query';

import { cx } from '@/components/layout/dashboard/styles';
import { getLiveStreams } from '@/service/api/liveStream';
import { IConnectionItem } from '@/service/interface/connection';
import { guardianConnectionsQueryOptions } from '@/service/query/connection';

const EMPTY_VALUE = '-';

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
  const recentConnection = getRecentConnection(connections);

  const stats = [
    {
      label: '연결된 피보호자',
      state: hasConnectionData ? 'ACTIVE 상태' : EMPTY_VALUE,
      value: formatCount(activeConnections.length, hasConnectionData, '명'),
    },
    {
      label: '요청 대기',
      state: hasConnectionData ? 'PENDING 상태' : EMPTY_VALUE,
      value: formatCount(pendingConnections.length, hasConnectionData, '건'),
    },
    {
      label: '실시간 송출',
      state: hasLiveStreamData ? '현재 세션' : EMPTY_VALUE,
      value: formatCount(activeStreamCount, hasLiveStreamData, '건'),
    },
    {
      label: 'AI 분석 중',
      state: hasLiveStreamData ? '실시간 감지' : EMPTY_VALUE,
      value: formatCount(analyzingStreamCount, hasLiveStreamData, '건'),
    },
  ];

  return (
    <div className={cx('contentGrid')}>
      <section className={cx('heroCard')}>
        <span className={cx('eyebrow')}>보호자 대시보드</span>
        <h2>피보호자 상태와 이상감지 현황을 한눈에 확인하세요.</h2>
        <p>연결된 피보호자와 실시간 송출 상태를 보호자 기준으로 정리했습니다.</p>
      </section>

      <section className={cx('statGrid')}>
        {stats.map(stat => (
          <div key={stat.label} className={cx('statCard')}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.state}</small>
          </div>
        ))}
      </section>

      <section className={cx('wideCard')}>
        <div>
          <span className={cx('eyebrow')}>최근 연결 현황</span>
          <h3>{recentConnection ? `${recentConnection.partnerName || EMPTY_VALUE} 님` : EMPTY_VALUE}</h3>
        </div>
        <div className={cx('statusList')}>
          <span>상태 · {recentConnection ? getStatusLabel(recentConnection.status) : EMPTY_VALUE}</span>
          <span>관계 · {recentConnection?.relation || EMPTY_VALUE}</span>
          <span>기준일 · {formatDate(recentConnection?.connectedAt ?? recentConnection?.createdAt)}</span>
        </div>
      </section>
    </div>
  );
}

function formatCount(count: number, hasData: boolean, suffix: string) {
  return hasData ? `${count}${suffix}` : EMPTY_VALUE;
}

function getRecentConnection(connections: IConnectionItem[]) {
  return [...connections].sort((a, b) => getTime(b.connectedAt ?? b.createdAt) - getTime(a.connectedAt ?? a.createdAt))[0] ?? null;
}

function getTime(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value?: string | null) {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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
