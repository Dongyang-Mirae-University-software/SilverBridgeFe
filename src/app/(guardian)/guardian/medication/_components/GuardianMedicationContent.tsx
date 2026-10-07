'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { WardSelectorTabs } from '@/components/connections/WardSelectorTabs';
import useKstMidnightRefetch from '@/hooks/useKstMidnightRefetch';
import { guardianMedicationQueryKey, guardianMedicationQueryOptions } from '@/service/query/guardian/medication';
import { WardMedicationCard } from './WardMedicationCard';
import styles from './GuardianMedicationContent.module.css';

const cx = classNames.bind(styles);

export function GuardianMedicationContent() {
  const { data, isLoading, isError, refetch } = useQuery(guardianMedicationQueryOptions);
  const wards = data ?? [];
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  useKstMidnightRefetch(guardianMedicationQueryKey);

  const selectedWard = wards.find(ward => ward.wardId === selectedWardId) ?? wards[0];

  return (
    <section className={cx('page')}>
      <header className={cx('toolbar')}>
        <RefreshButton ariaLabel="새로고침" disabled={isLoading} onRefresh={() => refetch()} />
      </header>

      {isLoading && <p className={cx('emptyText')}>복약 현황을 불러오는 중입니다.</p>}
      {isError && <p className={cx('emptyText')}>복약 현황을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && wards.length === 0 && <p className={cx('emptyText')}>연결된 피보호자가 없습니다.</p>}

      {wards.length > 0 && (
        <>
          <WardSelectorTabs wards={wards} selectedWardId={selectedWard?.wardId} onSelect={setSelectedWardId} />

          {selectedWard && <WardMedicationCard key={selectedWard.wardId} summary={selectedWard} />}
        </>
      )}
    </section>
  );
}
