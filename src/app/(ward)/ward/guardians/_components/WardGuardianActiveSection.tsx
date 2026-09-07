'use client';

import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { ConnectionList } from '@/components/connections/ConnectionCard';
import { EmptyState, getConnectionData } from '@/components/connections/ConnectionShared';
import { RefreshButton } from '@/components/RefreshButton';
import { useWardConnectionDisconnectMutation, useWardGuardianActiveConnectionsQuery } from '@/service/query/ward';
import useModalStore from '@/store/modalStore';
import styles from './WardGuardianActiveSection.module.css';

const cx = classNames.bind(styles);

export function WardGuardianActiveSection() {
  const { openModal, onCloseModal } = useModalStore(state => ({
    openModal: state.openModal,
    onCloseModal: state.onCloseModal,
  }));
  const activeQuery = useWardGuardianActiveConnectionsQuery();
  const disconnectMutation = useWardConnectionDisconnectMutation();
  const activeConnections = getConnectionData(activeQuery.data);

  const handleDisconnect = (connectionId: number) => {
    openModal(
      <CommonModal
        type="warning"
        tone="guardian"
        title="보호자 연결 해제"
        message="이 보호자와의 연결을 해제할까요?"
        primaryButton={{
          text: '해제',
          onClick: () => {
            onCloseModal();
            disconnectMutation.mutate(connectionId);
          },
        }}
        secondaryButton={{ text: '취소', onClick: onCloseModal }}
        onClose={onCloseModal}
      />,
    );
  };

  return (
    <section className={cx('connectionSection')}>
      <header className={cx('sectionHeader')}>
        <div>
          <h3>내 보호자 리스트</h3>
          <span>{activeConnections.length}건</span>
        </div>
        <RefreshButton
          ariaLabel="내 보호자 리스트 새로고침"
          disabled={activeQuery.isLoading}
          onRefresh={() => activeQuery.refetch()}
        />
      </header>

      {activeQuery.isError ? (
        <EmptyState message="내 보호자 목록을 불러오지 못했습니다." />
      ) : activeConnections.length > 0 ? (
        <ConnectionList
          connections={activeConnections}
          isPending={disconnectMutation.isPending}
          role="ward"
          getActions={connection => [{ label: '연결 해제', onClick: () => handleDisconnect(connection.id) }]}
        />
      ) : (
        !activeQuery.isLoading && <EmptyState message="연결된 보호자가 없습니다." />
      )}
    </section>
  );
}
