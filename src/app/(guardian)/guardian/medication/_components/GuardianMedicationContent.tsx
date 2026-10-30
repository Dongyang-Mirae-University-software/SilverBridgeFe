'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { RefreshButton } from '@/components/RefreshButton';
import { getConnectionData } from '@/components/connections/ConnectionShared';
import { WardSelectorTabs } from '@/components/connections/WardSelectorTabs';
import useKstMidnightRefetch from '@/hooks/useKstMidnightRefetch';
import { guardianConnectionsQueryOptions } from '@/service/query/guardian';
import { guardianMedicationQueryKey, guardianMedicationQueryOptions } from '@/service/query/guardian/medication';
import useModalStore from '@/store/modalStore';
import { MedicationAddModal } from './MedicationAddModal';
import { WardMedicationCard } from './WardMedicationCard';
import styles from './GuardianMedicationContent.module.css';

const cx = classNames.bind(styles);

export function GuardianMedicationContent() {
  const { data, isLoading, isError, refetch } = useQuery(guardianMedicationQueryOptions);
  const { data: connectionsData } = useQuery(guardianConnectionsQueryOptions);
  const wards = data ?? [];
  const activeConnections = getConnectionData(connectionsData).filter(connection => connection.status === 'ACTIVE');
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const { openModal, onCloseModal } = useModalStore(state => ({
    openModal: state.openModal,
    onCloseModal: state.onCloseModal,
  }));
  useKstMidnightRefetch(guardianMedicationQueryKey);

  const selectedWard = wards.find(ward => ward.wardId === selectedWardId) ?? wards[0];

  return (
    <section className={cx('page')}>
      <header className={cx('toolbar')}>
        <RefreshButton ariaLabel="새로고침" disabled={isLoading} onRefresh={() => refetch()} />
        {/* [약 추가]는 시안처럼 맨 위 오른쪽(2026-10-30) - 지금 고른 피보호자에게 추가한다 */}
        {selectedWard && (
          <button
            type="button"
            className={cx('addButton')}
            onClick={() => openModal(<MedicationAddModal wardId={selectedWard.wardId} onClose={onCloseModal} />)}
          >
            <Icon name="plus" size={17} decorative />약 추가
          </button>
        )}
      </header>

      {isLoading && <p className={cx('emptyText')}>복약 현황을 불러오는 중입니다.</p>}
      {isError && <p className={cx('emptyText')}>복약 현황을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && wards.length === 0 && <p className={cx('emptyText')}>연결된 피보호자가 없습니다.</p>}

      {wards.length > 0 && (
        <>
          <WardSelectorTabs
            wards={wards.map(ward => {
              const connection = activeConnections.find(item => item.partnerUserId === ward.wardId);
              return {
                wardId: ward.wardId,
                wardName: ward.wardName,
                profileImage: connection?.partnerProfileImage,
                relation: connection?.relation,
              };
            })}
            selectedWardId={selectedWard?.wardId}
            onSelect={setSelectedWardId}
          />

          {selectedWard && <WardMedicationCard key={selectedWard.wardId} summary={selectedWard} />}
        </>
      )}
    </section>
  );
}
