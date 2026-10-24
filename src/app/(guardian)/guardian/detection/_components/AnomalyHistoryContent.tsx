'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import {
  guardianAnomalyHistoryQueryOptions,
  guardianAnomalyHistorySummaryQueryOptions,
} from '@/service/query/guardian/anomaly';
import { AnomalyDetectedType, AnomalyHistorySummary } from '@/service/interface/guardian/anomaly';
import { AnomalyIncidentCard } from './AnomalyIncidentCard';
import { getPageWindow } from './anomalyFormat';
import styles from './AnomalyHistoryContent.module.css';

const cx = classNames.bind(styles);

const PAGE_SIZE = 10;
type TypeFilter = 'ALL' | AnomalyDetectedType;

const TYPE_CHIPS: Array<{ key: TypeFilter; label: string; count: (summary: AnomalyHistorySummary) => number }> = [
  { key: 'ALL', label: '전체', count: summary => summary.total },
  { key: 'FIRE', label: '화재', count: summary => summary.byType.fire },
  { key: 'WEAPON', label: '흉기', count: summary => summary.byType.weapon },
  { key: 'FALL', label: '낙상', count: summary => summary.byType.fall },
];

export interface WardOption {
  wardId: string;
  wardName: string;
}

// 건수는 불러온 목록을 세지 않고 요약 API 값을 쓴다(페이지·필터와 무관한 전체 기준).
// 유형 필터는 서버 쿼리(?type=)로 걸어 페이지·전체 건수가 필터 기준이 된다.
// 삭제된 카메라의 기록도 목록에 그대로 섞여 "삭제된 카메라"로 보인다.
export function AnomalyHistoryContent({
  wards,
  selectedWardId,
  onSelectWard,
}: {
  wards: WardOption[];
  selectedWardId?: string;
  onSelectWard: (wardId: string) => void;
}) {
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');

  const { data, isLoading, isError } = useQuery(
    guardianAnomalyHistoryQueryOptions({
      page,
      size: PAGE_SIZE,
      wardId: selectedWardId,
      type: typeFilter === 'ALL' ? undefined : typeFilter,
    }),
  );
  // 요약을 못 받으면 건수를 비워 둔다(0으로 채우지 않는다)
  const { data: summary } = useQuery(guardianAnomalyHistorySummaryQueryOptions(selectedWardId));

  const incidents = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  const selectType = (type: TypeFilter) => {
    setTypeFilter(type);
    setPage(0);
  };

  return (
    <section className={cx('page')}>
      {wards.length > 0 && (
        <div className={cx('chipRow')} role="group" aria-label="피보호자 선택">
          {wards.map(ward => {
            const isActive = ward.wardId === selectedWardId;
            return (
              <button
                key={ward.wardId}
                type="button"
                className={cx('chip', 'wardChip', { active: isActive })}
                aria-pressed={isActive}
                onClick={() => {
                  onSelectWard(ward.wardId);
                  setTypeFilter('ALL');
                  setPage(0);
                }}
              >
                <span className={cx('wardInitial')}>{ward.wardName.charAt(0)}</span>
                {ward.wardName} 님
              </button>
            );
          })}
        </div>
      )}

      <div className={cx('chipRow')}>
        <div className={cx('chipGroup')} role="group" aria-label="감지 유형">
          {TYPE_CHIPS.map(chip => (
            <button
              key={chip.key}
              type="button"
              className={cx('chip', { active: typeFilter === chip.key })}
              aria-pressed={typeFilter === chip.key}
              onClick={() => selectType(chip.key)}
            >
              {chip.label}
              {summary && <span className={cx('chipCount')}>{chip.count(summary)}</span>}
            </button>
          ))}
        </div>
        {summary && (
          <span className={cx('needsReview', { none: summary.needsReviewCount === 0 })} role="status">
            <span className={cx('needsReviewDot')} />
            확인 필요 <span className={cx('chipCount')}>{summary.needsReviewCount}</span>
          </span>
        )}
      </div>

      <div className={cx('listCard')}>
        {isLoading && <p className={cx('emptyText')}>감지 기록을 불러오는 중이에요.</p>}
        {isError && <p className={cx('emptyText')}>감지 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
        {!isLoading && !isError && incidents.length === 0 && (
          <p className={cx('emptyText')}>
            {typeFilter === 'ALL' ? '감지 기록이 없어요' : '이 유형의 감지 기록이 없어요'}
          </p>
        )}
        {incidents.length > 0 && (
          <ul className={cx('list')}>
            {incidents.map(incident => (
              <AnomalyIncidentCard key={incident.incidentId} incident={incident} />
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <nav className={cx('pager')} aria-label="페이지 이동">
          <button type="button" className={cx('pageButton')} disabled={page === 0} onClick={() => setPage(page - 1)}>
            이전
          </button>
          {getPageWindow(page, totalPages).map(index => (
            <button
              key={index}
              type="button"
              className={cx('pageButton', { active: index === page })}
              aria-current={index === page ? 'page' : undefined}
              onClick={() => setPage(index)}
            >
              {index + 1}
            </button>
          ))}
          <button
            type="button"
            className={cx('pageButton')}
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            다음
          </button>
        </nav>
      )}
    </section>
  );
}
