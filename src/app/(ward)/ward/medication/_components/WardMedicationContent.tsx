'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import useKstMidnightRefetch from '@/hooks/useKstMidnightRefetch';
import { wardTodayMedicationQueryKey, wardTodayMedicationQueryOptions } from '@/service/query/ward/medication';
import { sortMedicationsByDoseTime } from '@/utils/format/medication';
import { WardMedicationCard } from './WardMedicationCard';
import styles from './WardMedicationContent.module.css';

const cx = classNames.bind(styles);

export function WardMedicationContent() {
  const { data, isLoading, isError, refetch } = useQuery(wardTodayMedicationQueryOptions);
  useKstMidnightRefetch(wardTodayMedicationQueryKey);

  const takenCount = data?.takenCount ?? 0;
  const totalCount = data?.totalCount ?? 0;
  const medications = sortMedicationsByDoseTime(data?.medications ?? []);

  return (
    <section className={cx('page')}>
      <header className={cx('toolbar')}>
        <div>
          <strong className={cx('toolbarTitle')}>오늘의 복약</strong>
          <span className={cx('toolbarSub')}>
            {takenCount}/{totalCount}회 완료
          </span>
        </div>
        <RefreshButton ariaLabel="새로고침" disabled={isLoading} onRefresh={() => refetch()} />
      </header>

      {isLoading && <p className={cx('emptyText')}>복약 일정을 불러오는 중입니다.</p>}
      {isError && <p className={cx('emptyText')}>복약 일정을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && medications.length === 0 && (
        <p className={cx('emptyText')}>오늘 등록된 복약 일정이 없습니다.</p>
      )}
      {!isLoading && !isError && medications.length > 0 && (
        <ul className={cx('list')}>
          {medications.map(medication => (
            <WardMedicationCard key={medication.medicationId} medication={medication} />
          ))}
        </ul>
      )}
    </section>
  );
}
