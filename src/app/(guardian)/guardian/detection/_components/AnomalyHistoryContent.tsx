'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import {
  guardianAnomalyHistoryQueryOptions,
  guardianAnomalyHistorySummaryQueryOptions,
} from '@/service/query/guardian/anomaly';
import { AnomalyDetectedType, AnomalyHistorySummary } from '@/service/interface/guardian/anomaly';
import { Tabs } from '@/components/Tabs';
import { WardSelectorTabs } from '@/components/connections/WardSelectorTabs';
import { AnomalyIncidentCard } from './AnomalyIncidentCard';
import { getPageWindow } from './anomalyFormat';
import styles from './AnomalyHistoryContent.module.css';

const cx = classNames.bind(styles);

// v13: 이상감지 목록은 한 화면에서 영상·판정 버튼을 함께 읽을 수 있도록 4건씩 보여 준다.
const PAGE_SIZE = 4;
type TypeFilter = 'ALL' | AnomalyDetectedType;
// 분류 탭과 "삭제된 카메라 기록" 스위치 중 하나만 고른다(스위치를 켜면 탭 선택이 풀리고, 탭을 누르면 스위치가 꺼진다)
type HistoryFilter = TypeFilter | 'DELETED_CAMERA';

const TYPE_TABS: Array<{ key: TypeFilter; label: string; count: (summary: AnomalyHistorySummary) => number }> = [
  { key: 'ALL', label: '전체', count: summary => summary.total },
  { key: 'FIRE', label: '화재', count: summary => summary.byType.fire },
  { key: 'WEAPON', label: '흉기', count: summary => summary.byType.weapon },
  { key: 'FALL', label: '낙상', count: summary => summary.byType.fall },
];

export interface WardOption {
  wardId: string;
  wardName: string;
  profileImage?: string | null;
  relation?: string | null;
}

// 건수는 불러온 목록을 세지 않고 요약 API 값을 쓴다(페이지·필터와 무관한 전체 기준).
// 유형 필터는 서버 쿼리(?type=)로 걸어 페이지·전체 건수가 필터 기준이 된다.
// 요약 건수(전체·유형·확인 필요)는 지금 등록된 카메라 기준이라(BE 2026-10-25) 전체·유형 탭도 ?camera=EXISTING으로 받아 숫자와 목록을 맞춘다.
// 삭제된 카메라의 기록은 그 기록만 보는 스위치(?camera=DELETED)를 켰을 때만 보이고, 스위치는 1건 이상일 때 보인다.
export function AnomalyHistoryContent({
  wards,
  selectedWardId,
  onSelectWard,
  wardsReady = true,
}: {
  wards: WardOption[];
  selectedWardId?: string;
  onSelectWard: (wardId: string) => void;
  // 피보호자 목록을 받았는가. 받기 전에는 wardId 없이(전체 피보호자) 조회해 다른 사람 기록·건수가 잠깐 보이므로 기다린다
  wardsReady?: boolean;
}) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<HistoryFilter>('ALL');

  const { data, isLoading: isHistoryLoading, isError } = useQuery({
    ...guardianAnomalyHistoryQueryOptions({
      page,
      size: PAGE_SIZE,
      wardId: selectedWardId,
      type: filter === 'ALL' || filter === 'DELETED_CAMERA' ? undefined : filter,
      camera: filter === 'DELETED_CAMERA' ? 'DELETED' : 'EXISTING',
    }),
    enabled: wardsReady,
  });
  const isLoading = !wardsReady || isHistoryLoading;
  // 요약을 못 받으면 건수를 비워 둔다(0으로 채우지 않는다)
  const { data: summary } = useQuery({ ...guardianAnomalyHistorySummaryQueryOptions(selectedWardId), enabled: wardsReady });

  const incidents = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  const deletedCameraCount = summary?.deletedCameraCount ?? 0;

  const isDeletedView = filter === 'DELETED_CAMERA';
  const showDeletedSwitch = deletedCameraCount > 0 || isDeletedView;

  const selectFilter = (next: HistoryFilter) => {
    setFilter(next);
    setPage(0);
  };

  return (
    <section className={cx('page')}>
      {wards.length > 0 && (
        <div className={cx('wardSelect')}>
          <WardSelectorTabs
            wards={wards}
            selectedWardId={selectedWardId}
            onSelect={wardId => {
              onSelectWard(wardId);
              setFilter('ALL');
              setPage(0);
            }}
          />
        </div>
      )}

      {/* 1줄: 분류 탭. 삭제된 카메라 기록을 보는 중이면 어느 탭도 선택되지 않고 흐리게 보이며, 탭을 누르면 그 분류로 돌아간다 */}
      <Tabs<HistoryFilter>
        ariaLabel="감지 유형"
        stretch
        className={cx('typeTabs', { dimmed: isDeletedView })}
        value={filter}
        onChange={selectFilter}
        items={TYPE_TABS.map(tab => ({
          value: tab.key,
          label: (
            <>
              {tab.label}
              {summary && <span className={cx('tabCount')}> {tab.count(summary)}</span>}
            </>
          ),
        }))}
      />

      {/* 2줄: 확인 필요 = 건수 표시(필터 아님) / 삭제된 카메라 기록 = 켜고 끄는 보기 */}
      {(summary || showDeletedSwitch) && (
        <div className={cx('subRow')}>
          {summary && (
            <span className={cx('needsReview', { none: summary.needsReviewCount === 0 })} role="status">
              <span className={cx('needsReviewDot')} aria-hidden="true" />
              확인 필요 <span className={cx('count')}>{summary.needsReviewCount}</span>
            </span>
          )}
          {/* 고른 채로 0건이 돼도(마지막 기록이 지워짐) 끌 수 있게 켜져 있으면 남긴다 */}
          {showDeletedSwitch && (
            <label className={cx('deletedSwitch')}>
              <span className={cx('deletedSwitchLabel')}>
                삭제된 카메라 기록 <span className={cx('count')}>{deletedCameraCount}</span>
              </span>
              <span className={cx('toggle')}>
                <input
                  type="checkbox"
                  role="switch"
                  checked={isDeletedView}
                  onChange={e => selectFilter(e.target.checked ? 'DELETED_CAMERA' : 'ALL')}
                />
                <span className={cx('toggleThumb')} aria-hidden="true" />
              </span>
            </label>
          )}
        </div>
      )}

      <div className={cx('listCard')}>
        {isLoading && <p className={cx('emptyText')}>감지 기록을 불러오는 중이에요.</p>}
        {isError && <p className={cx('emptyText')}>감지 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
        {!isLoading && !isError && incidents.length === 0 && (
          <p className={cx('emptyText')}>
            {filter === 'ALL'
              ? // "전체"는 지금 등록된 카메라 기록만이라, 삭제된 카메라 기록이 있으면 아예 없는 것처럼 말하지 않는다
                deletedCameraCount > 0
                ? '지금 카메라의 감지 기록이 없어요. 삭제된 카메라의 기록은 "삭제된 카메라 기록"을 켜면 볼 수 있어요'
                : '감지 기록이 없어요'
              : filter === 'DELETED_CAMERA'
                ? '삭제된 카메라의 기록이 없어요'
                : '이 유형의 감지 기록이 없어요'}
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
