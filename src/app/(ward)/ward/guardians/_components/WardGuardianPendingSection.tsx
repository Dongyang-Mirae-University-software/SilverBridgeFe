'use client';

import { useEffect, useState } from 'react';
import classNames from 'classnames/bind';

import { ConnectionList } from '@/components/connections/ConnectionCard';
import { EmptyState, getConnectionData } from '@/components/connections/ConnectionShared';
import { RefreshButton } from '@/components/RefreshButton';
import {
  getPendingConnectionRequestItems,
  PENDING_CONNECTION_REQUESTS_EVENT,
} from '@/lib/realtime/pendingConnectionRequests';
import type { IWardPendingConnectionRequest } from '@/service/interface/connection';
import {
  useWardConnectionAcceptMutation,
  useWardConnectionRefuseMutation,
  useWardGuardianPendingConnectionsQuery,
} from '@/service/query/ward';
import styles from './WardGuardianPendingSection.module.css';

const cx = classNames.bind(styles);

export function WardGuardianPendingSection() {
  const [storedPendingConnections, setStoredPendingConnections] = useState(() => getPendingConnectionRequestItems());
  const pendingQuery = useWardGuardianPendingConnectionsQuery();
  const acceptMutation = useWardConnectionAcceptMutation();
  const refuseMutation = useWardConnectionRefuseMutation();

  const apiPendingConnections = getWardPendingConnectionData(pendingQuery.data);
  const pendingConnections = mergePendingConnections(
    apiPendingConnections.map(mapWardPendingRequestToConnection),
    storedPendingConnections,
  );
  const isPending = acceptMutation.isPending || refuseMutation.isPending;

  useEffect(() => {
    const syncStoredPendingConnections = () => setStoredPendingConnections(getPendingConnectionRequestItems());

    window.addEventListener(PENDING_CONNECTION_REQUESTS_EVENT, syncStoredPendingConnections);
    return () => window.removeEventListener(PENDING_CONNECTION_REQUESTS_EVENT, syncStoredPendingConnections);
  }, []);

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

function getWardPendingConnectionData(response: unknown) {
  const data = (response as { data?: unknown } | undefined)?.data;
  if (Array.isArray(data)) return data as IWardPendingConnectionRequest[];

  const nestedData = (data as { data?: unknown } | undefined)?.data;
  return Array.isArray(nestedData) ? (nestedData as IWardPendingConnectionRequest[]) : [];
}

function mergePendingConnections(...connectionGroups: ReturnType<typeof getConnectionData>[]) {
  const pendingConnectionMap = new Map<number, ReturnType<typeof getConnectionData>[number]>();

  connectionGroups.flat().forEach(connection => {
    pendingConnectionMap.set(connection.id, connection);
  });

  return Array.from(pendingConnectionMap.values());
}

function mapWardPendingRequestToConnection(request: IWardPendingConnectionRequest) {
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
