'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { WardSelectorTabs } from '@/components/connections/WardSelectorTabs';
import { useGuardianActiveWards } from '@/hooks/useActiveConnections';
import { formatTime } from '@/utils/format/date';
import { guardianSosHistoryQueryOptions } from '@/service/query/guardian';
import type { IGuardianSosHistoryItem, SosTriggerType } from '@/service/interface/guardian/sosHistory';
import { setSelectedWardId, useSelectedWard } from '@/store/selectedWardStore';
import styles from './GuardianSosHistoryContent.module.css';

const cx = classNames.bind(styles);
const PAGE_SIZE = 5;

const TRIGGER_TYPE_META: Record<SosTriggerType, { filterLabel: string; tone: 'guardian' | 'sos' }> = {
  SOS_BUTTON: { filterLabel: 'SOS 버튼', tone: 'sos' },
  GUARDIAN_CALL: { filterLabel: '보호자 연락', tone: 'guardian' },
};

type TriggerTypeFilter = 'ALL' | SosTriggerType;

export default function GuardianSosHistoryContent() {
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<TriggerTypeFilter>('ALL');
  const [page, setPage] = useState(0);

  const {
    activeWards,
    hasActiveWards,
    isLoading: isWardsLoading,
    isError: isWardsError,
    refetch: refetchWards,
  } = useGuardianActiveWards();
  const effectiveSelectedWardId = useSelectedWard(activeWards, ward => ward.partnerUserId)?.partnerUserId ?? null;

  const { data, isLoading, isError, isFetching } = useQuery({
    ...guardianSosHistoryQueryOptions({
      wardId: effectiveSelectedWardId ?? undefined,
      triggerType: triggerTypeFilter === 'ALL' ? undefined : triggerTypeFilter,
      group: true,
      page,
      size: PAGE_SIZE,
    }),
    enabled: hasActiveWards,
  });

  const items = data?.content ?? [];
  const counts = data?.counts;

  const hasNextPage = data ? !data.last : false;
  const hasPrevPage = page > 0;
  // 목록을 받기 전·실패했을 때 "연결된 피보호자가 없습니다"로 보이지 않게 따로 안내한다
  if (isWardsLoading) {
    return (
      <div className={cx('page')}>
        <p className={cx('emptyState')} role="status">
          피보호자 정보를 불러오는 중이에요.
        </p>
      </div>
    );
  }

  // 이미 받은 목록이 있으면 갱신 실패여도 그대로 보여 준다
  if (isWardsError && !hasActiveWards) {
    return (
      <div className={cx('page')}>
        <div className={cx('emptyState')} role="alert">
          <strong>피보호자 정보를 불러오지 못했어요.</strong>
          <button className={cx('retryButton')} type="button" onClick={() => void refetchWards()}>
            다시 불러오기
          </button>
        </div>
      </div>
    );
  }

  if (!hasActiveWards) {
    return (
      <div className={cx('page')}>
        <div className={cx('emptyState')}>
          <strong>연결된 피보호자가 없습니다.</strong>
          <span>피보호자와 연결되면 SOS 이력을 확인할 수 있습니다.</span>
        </div>
      </div>
    );
  }

  function handleSelectWard(wardId: string | null) {
    setSelectedWardId(wardId);
    setPage(0);
  }

  return (
    <div className={cx('page')}>
      <div className={cx('filters')}>
        <div className={cx('wardTabs')}>
          <WardSelectorTabs
            wards={activeWards.map(ward => ({
              wardId: ward.partnerUserId,
              wardName: ward.partnerName,
              profileImage: ward.partnerProfileImage,
              relation: ward.relation,
            }))}
            selectedWardId={effectiveSelectedWardId ?? undefined}
            onSelect={handleSelectWard}
          />
        </div>
        <div className={cx('typeFilters')} role="tablist" aria-label="발생 경로 필터">
          {([
            ['ALL', '전체', counts?.all ?? 0],
            ['SOS_BUTTON', TRIGGER_TYPE_META.SOS_BUTTON.filterLabel, counts?.sosButton ?? 0],
            ['GUARDIAN_CALL', TRIGGER_TYPE_META.GUARDIAN_CALL.filterLabel, counts?.guardianCall ?? 0],
          ] as const).map(([type, label, count]) => (
            <button
              key={type}
              type="button"
              className={cx('typeFilter', { typeFilterActive: triggerTypeFilter === type })}
              onClick={() => {
                setTriggerTypeFilter(type);
                setPage(0);
              }}
            >
              {type === 'SOS_BUTTON' && <span className={cx('triggerIcon', 'sosIcon')}>SOS</span>}
              {type === 'GUARDIAN_CALL' && (
                <span className={cx('triggerIcon', 'callIcon')}>
                  <Icon name="phone" size={13} decorative />
                </span>
              )}
              {label} <strong>{count}</strong>
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className={cx('emptyState')}>
          <strong>SOS 이력을 불러오지 못했습니다.</strong>
          <span>잠시 후 다시 시도해주세요.</span>
        </div>
      ) : isLoading ? (
        <div className={cx('emptyState')}>
          <strong>SOS 이력을 불러오는 중입니다.</strong>
        </div>
      ) : (
        <div className={cx('historyCard')}>
          {items.length === 0 ? (
            <div className={cx('emptyState')}>해당 조건의 호출 기록이 없습니다.</div>
          ) : (
            <ul className={cx('list')}>
              {items.map((item: IGuardianSosHistoryItem) => (
                <li key={item.sosEventId} className={cx('item')}>
                  <span className={cx('eventMarker', TRIGGER_TYPE_META[item.triggerType].tone)} aria-hidden="true">
                    {item.triggerType === 'SOS_BUTTON' ? 'SOS' : <Icon name="phone" size={25} />}
                  </span>
                  <div className={cx('eventTime')}>
                    <strong>{formatSosDate(item.triggeredAt)}</strong>
                    <span>{formatSosTime(item)}</span>
                  </div>
                  {/* v13 시안: 설명 문구 없이 SOS는 연달아 누른 횟수, 보호자 연락은 받은 보호자만 뱃지로 */}
                  {item.pressCount !== undefined && item.pressCount >= 2 && <strong className={cx('pressBadge')}>{item.pressCount}번 연달아 누름</strong>}
                  {item.calledGuardianName && (
                    <span className={cx('guardianChip')}>
                      <i aria-hidden="true">{item.calledGuardianName.slice(0, 1)}</i>
                      {item.calledGuardianName.split(' ')[0]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Pagination
        page={page}
        hasPrevPage={hasPrevPage}
        hasNextPage={hasNextPage}
        disabled={isFetching}
        onChange={setPage}
        totalPages={data?.totalPages}
        variant="numbered"
      />
    </div>
  );
}

function formatSosDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(date) + ` (${weekday})`;
}

function formatSosTime(item: IGuardianSosHistoryItem) {
  if (item.pressCount && item.pressCount >= 2 && item.firstTriggeredAt && item.lastTriggeredAt) {
    return `${formatTime(item.firstTriggeredAt)}~${formatTime(item.lastTriggeredAt)}`;
  }
  return formatTime(item.triggeredAt);
}
