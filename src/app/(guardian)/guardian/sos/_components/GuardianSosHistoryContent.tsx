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
import styles from './GuardianSosHistoryContent.module.css';

const cx = classNames.bind(styles);
const PAGE_SIZE = 5;

const TRIGGER_TYPE_META: Record<SosTriggerType, { filterLabel: string; description: string; tone: 'guardian' | 'sos' }> = {
  SOS_BUTTON: { filterLabel: 'SOS 버튼', description: '긴급 SOS 버튼을 눌렀어요', tone: 'sos' },
  GUARDIAN_CALL: { filterLabel: '직접 전화', description: '보호자에게 직접 전화했어요', tone: 'guardian' },
};

type TriggerTypeFilter = 'ALL' | SosTriggerType;

export default function GuardianSosHistoryContent() {
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<TriggerTypeFilter>('ALL');
  const [page, setPage] = useState(0);

  const { activeWards, hasActiveWards } = useGuardianActiveWards();
  const selectedWard = activeWards.find(ward => ward.partnerUserId === selectedWardId);
  const effectiveSelectedWardId = selectedWard?.partnerUserId ?? activeWards[0]?.partnerUserId ?? null;

  const { data, isLoading, isError, isFetching } = useQuery({
    ...guardianSosHistoryQueryOptions({
      wardId: effectiveSelectedWardId ?? undefined,
      triggerType: triggerTypeFilter === 'ALL' ? undefined : triggerTypeFilter,
      page,
      size: PAGE_SIZE,
    }),
    enabled: hasActiveWards,
  });

  const items = data?.content ?? [];
  const counts = data?.counts;

  const hasNextPage = data ? !data.last : false;
  const hasPrevPage = page > 0;
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
                    <span>{formatTime(item.triggeredAt)}</span>
                  </div>
                  <span className={cx('eventDescription')}>{TRIGGER_TYPE_META[item.triggerType].description}</span>
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
