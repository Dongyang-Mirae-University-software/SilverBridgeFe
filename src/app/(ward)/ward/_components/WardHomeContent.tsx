'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { WARD_ACTIONS } from '@/constants/dashboard';
import { cx } from '@/components/layout/dashboard/styles';
import { IConnectionItem } from '@/service/interface/connection';
import { wardConnectionsQueryOptions } from '@/service/query/connection';

const EMPTY_VALUE = '-';

export function WardHomeContent() {
  const { data: connectionsResponse, isError, isLoading } = useQuery(wardConnectionsQueryOptions);
  const connections = Array.isArray(connectionsResponse?.data) ? connectionsResponse.data : [];
  const hasConnectionData = !isLoading && !isError && Array.isArray(connectionsResponse?.data);
  const activeConnections = connections.filter(connection => connection.status === 'ACTIVE');
  const pendingConnections = connections.filter(connection => connection.status === 'PENDING');
  const recentConnection = getRecentConnection(connections);
  const stats = [
    {
      label: '연결된 보호자',
      state: hasConnectionData ? 'ACTIVE 상태' : EMPTY_VALUE,
      value: formatCount(activeConnections.length, hasConnectionData, '명'),
    },
    {
      label: '요청 대기',
      state: hasConnectionData ? 'PENDING 상태' : EMPTY_VALUE,
      value: formatCount(pendingConnections.length, hasConnectionData, '건'),
    },
    {
      label: '전체 연결',
      state: hasConnectionData ? '현재 조회 기준' : EMPTY_VALUE,
      value: formatCount(connections.length, hasConnectionData, '건'),
    },
    {
      label: '최근 상태',
      state: recentConnection?.relation || EMPTY_VALUE,
      value: recentConnection ? getStatusLabel(recentConnection.status) : EMPTY_VALUE,
    },
  ];

  return (
    <div className={cx('contentGrid')}>
      <section className={cx('heroCard')}>
        <span className={cx('eyebrow')}>피보호자 홈</span>
        <h2>긴급 도움과 보호자 연결 상태를 바로 확인하세요.</h2>
        <p>연결된 보호자와 대기 중인 요청을 실제 연결 데이터 기준으로 보여드립니다.</p>
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

      <section className={cx('quickGrid', 'wardHomeActionGrid')}>
        {WARD_ACTIONS.map(action => (
          <Link key={action.href} className={cx('actionCard')} href={action.href}>
            <strong>{action.label}</strong>
          </Link>
        ))}
      </section>

      <section className={cx('wideCard')}>
        <div>
          <span className={cx('eyebrow')}>최근 보호자 연결</span>
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
