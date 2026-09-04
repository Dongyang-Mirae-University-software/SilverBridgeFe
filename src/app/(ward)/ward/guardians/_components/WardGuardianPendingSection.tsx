'use client';

import classNames from 'classnames/bind';

import { ConnectionList } from '@/components/connections/ConnectionCard';
import { EmptyState, getConnectionData } from '@/components/connections/ConnectionShared';
import { RefreshButton } from '@/components/RefreshButton';
import {
  useWardConnectionAcceptMutation,
  useWardConnectionRefuseMutation,
  useWardGuardianPendingConnectionsQuery,
} from '@/service/query/ward';
import styles from './WardGuardianPendingSection.module.css';

const cx = classNames.bind(styles);

export function WardGuardianPendingSection() {
  const pendingQuery = useWardGuardianPendingConnectionsQuery();
  const acceptMutation = useWardConnectionAcceptMutation();
  const refuseMutation = useWardConnectionRefuseMutation();

  const pendingConnections = getConnectionData(pendingQuery.data);
  const isPending = acceptMutation.isPending || refuseMutation.isPending;

  return (
    <section className={cx('connectionSection')}>
      <header className={cx('sectionHeader')}>
        <div>
          <h3>요청온 목록</h3>
          <span>{pendingConnections.length}건</span>
        </div>
        <RefreshButton
          ariaLabel="요청온 목록 새로고침"
          disabled={pendingQuery.isLoading}
          onRefresh={() => pendingQuery.refetch()}
        />
      </header>

      {pendingQuery.isError ? (
        <EmptyState message="요청온 목록을 불러오지 못했습니다." />
      ) : pendingConnections.length > 0 ? (
        <ConnectionList
          connections={pendingConnections}
          isPending={isPending}
          role="ward"
          getActions={connection => [
            { label: '수락', onClick: () => acceptMutation.mutate(connection.id) },
            { label: '거절', onClick: () => refuseMutation.mutate(connection.id), variant: 'secondary' },
          ]}
        />
      ) : (
        !pendingQuery.isLoading && <EmptyState message="수락 또는 거절하지 않은 연결 요청이 없습니다." />
      )}
    </section>
  );
}
