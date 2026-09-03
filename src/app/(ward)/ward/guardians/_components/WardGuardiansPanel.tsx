'use client';

import { useEffect, useState } from 'react';

import { CommonModal } from '@/components/CommonModal';
import { RefreshButton } from '@/components/RefreshButton';
import {
  useWardConnectionAcceptMutation,
  useWardConnectionDisconnectMutation,
  useWardConnectionRefuseMutation,
  useWardGuardianActiveConnectionsQuery,
  useWardGuardianPendingConnectionsQuery,
} from '@/service/query/ward';
import {
  getPendingConnectionRequestItems,
  PENDING_CONNECTION_REQUESTS_EVENT,
} from '@/lib/realtime/pendingConnectionRequests';
import classNames from 'classnames/bind';
import { ConnectionList } from '@/components/connections/ConnectionCard';
import { EmptyState, getConnectionData } from '@/components/connections/ConnectionShared';
import useModalStore from '@/store/modalStore';
import styles from './WardGuardiansPanel.module.css';

const cx = classNames.bind(styles);

export function WardGuardiansPanel() {
  const { openModal, onCloseModal } = useModalStore(state => ({
    openModal: state.openModal,
    onCloseModal: state.onCloseModal,
  }));

  const [storedPendingConnections, setStoredPendingConnections] = useState(() => getPendingConnectionRequestItems());
  const activeQuery = useWardGuardianActiveConnectionsQuery();
  const pendingQuery = useWardGuardianPendingConnectionsQuery();

  const activeConnections = getConnectionData(activeQuery.data);
  const apiPendingConnections = getWardPendingConnectionData(pendingQuery.data);
  const pendingConnections = mergePendingConnections(
    apiPendingConnections.map(mapWardPendingRequestToConnection),
    storedPendingConnections,
  );
  const isRefreshing = activeQuery.isLoading || pendingQuery.isLoading;
  const isError = activeQuery.isError && pendingQuery.isError;

  useEffect(() => {
    const syncStoredPendingConnections = () => setStoredPendingConnections(getPendingConnectionRequestItems());

    window.addEventListener(PENDING_CONNECTION_REQUESTS_EVENT, syncStoredPendingConnections);
    return () => window.removeEventListener(PENDING_CONNECTION_REQUESTS_EVENT, syncStoredPendingConnections);
  }, []);

  const acceptMutation = useWardConnectionAcceptMutation();
  const refuseMutation = useWardConnectionRefuseMutation();
  const disconnectMutation = useWardConnectionDisconnectMutation();

  const isPending = acceptMutation.isPending || refuseMutation.isPending || disconnectMutation.isPending;
  const handleDisconnect = (connectionId: number) => {
    openModal(
      <CommonModal
        type="warning"
        tone="guardian"
        title="보호자 연결 해제"
        message="이 보호자와의 연결을 해제할까요?"
        confirmText="해제"
        secondaryText="취소"
        onConfirm={() => {
          onCloseModal();
          disconnectMutation.mutate(connectionId);
        }}
        onSecondary={onCloseModal}
        onClose={onCloseModal}
      />,
    );
  };

  return (
    <section className={cx('connectionPage')}>
      <div className={cx('connectionPageActions')}>
        <RefreshButton
          ariaLabel="보호자 목록 새로고침"
          disabled={isRefreshing}
          onRefresh={() => Promise.all([activeQuery.refetch(), pendingQuery.refetch()])}
        />
      </div>

      {isError && <EmptyState message="내 보호자 목록을 불러오지 못했습니다." />}

      <section className={cx('connectionSection')}>
        <div className={cx('connectionSectionHeader')}>
          <h3>내 보호자 리스트</h3>
          <span>{activeConnections.length}건</span>
        </div>
        {activeQuery.isError ? (
          <EmptyState message="내 보호자 목록을 불러오지 못했습니다." />
        ) : activeConnections.length > 0 ? (
          <ConnectionList
            connections={activeConnections}
            isPending={isPending}
            role="ward"
            getActions={connection => [{ label: '연결 해제', onClick: () => handleDisconnect(connection.id) }]}
          />
        ) : (
          !activeQuery.isLoading && <EmptyState message="연결된 보호자가 없습니다." />
        )}
      </section>

      <section className={cx('connectionSection')}>
        <div className={cx('connectionSectionHeader')}>
          <h3>요청온 목록</h3>
          <span>{pendingConnections.length}건</span>
        </div>
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
    </section>
  );
}

function getWardPendingConnectionData(response: unknown) {
  const data = (response as { data?: unknown } | undefined)?.data;
  if (Array.isArray(data)) return data;

  const nestedData = (data as { data?: unknown } | undefined)?.data;
  return Array.isArray(nestedData) ? nestedData : [];
}

function mergePendingConnections(...connectionGroups: ReturnType<typeof getConnectionData>[]) {
  const pendingConnectionMap = new Map<number, ReturnType<typeof getConnectionData>[number]>();

  connectionGroups.flat().forEach(connection => {
    pendingConnectionMap.set(connection.id, connection);
  });

  return Array.from(pendingConnectionMap.values());
}

function mapWardPendingRequestToConnection(request: {
  connectionId: number;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  relation: string;
  requestedAt: string;
}) {
  return {
    connectedAt: null,
    createdAt: request.requestedAt,
    id: request.connectionId,
    partnerAddress: null,
    partnerAddressDetail: null,
    partnerBirthDate: null,
    partnerEmail: null,
    partnerGender: null,
    partnerName: request.guardianName,
    partnerPhone: request.guardianPhone,
    partnerPostcode: null,
    partnerProfileImage: null,
    partnerUserId: request.guardianId,
    relation: request.relation,
    requester: false,
    status: 'PENDING',
  } as const;
}
