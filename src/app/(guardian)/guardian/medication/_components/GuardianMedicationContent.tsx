'use client';

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
  useKstMidnightRefetch(guardianMedicationQueryKey);

  return (
    <section className={cx('page')}>
      <header className={cx('toolbar')}>
        <div>
          <strong className={cx('toolbarTitle')}>복약 관리</strong>
          <span className={cx('toolbarSub')}>연결된 피보호자 {wards.length}명</span>
        </div>
        <RefreshButton ariaLabel="새로고침" disabled={isLoading} onRefresh={() => refetch()} />
      </header>

      {isLoading && <p className={cx('emptyText')}>복약 현황을 불러오는 중입니다.</p>}
      {isError && <p className={cx('emptyText')}>복약 현황을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && wards.length === 0 && (
        <p className={cx('emptyText')}>연결된 피보호자가 없습니다.</p>
      )}

      <ul className={cx('list')}>
        {wards.map(summary => (
          <WardMedicationCard key={summary.wardId} summary={summary} />
        ))}
      </ul>
    </section>
  );
}
