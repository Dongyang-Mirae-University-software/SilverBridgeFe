'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
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
          <div className={cx('wardTabs')} role="tablist" aria-label="피보호자 선택">
            {wards.map(ward => {
              const isActive = ward.wardId === selectedWard?.wardId;
              return (
                <button
                  key={ward.wardId}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={cx('wardTab', { wardTabActive: isActive })}
                  onClick={() => setSelectedWardId(ward.wardId)}
                >
                  <span className={cx('wardTabAvatar')}>{(ward.wardName ?? '피').charAt(0)}</span>
                  {ward.wardName ?? '피보호자'} 님
                </button>
              );
            })}
          </div>

          {selectedWard && <WardMedicationCard key={selectedWard.wardId} summary={selectedWard} />}
        </>
      )}
    </section>
  );
}
