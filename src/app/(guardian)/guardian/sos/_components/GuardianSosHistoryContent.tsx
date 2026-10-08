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
const PAGE_SIZE = 50;
const UNKNOWN_WARD_NAME = '탈퇴한 사용자';

const TRIGGER_TYPE_META: Record<SosTriggerType, { label: string; icon: 'bell' | 'phone'; tone: 'guardian' | 'sos' }> = {
  SOS_BUTTON: { label: '긴급 SOS 버튼', icon: 'phone', tone: 'sos' },
  GUARDIAN_CALL: { label: '보호자에게 알림', icon: 'bell', tone: 'guardian' },
};

type TriggerTypeFilter = 'ALL' | SosTriggerType;

export default function GuardianSosHistoryContent() {
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<TriggerTypeFilter>('ALL');
  const [page, setPage] = useState(0);

  const { activeWards, hasActiveWards } = useGuardianActiveWards();
  const selectedWard = activeWards.find(ward => ward.partnerUserId === selectedWardId);
  const effectiveSelectedWardId = selectedWard?.partnerUserId ?? null;

  const { data, isLoading, isError, isFetching } = useQuery({
    ...guardianSosHistoryQueryOptions({ wardId: effectiveSelectedWardId ?? undefined, page, size: PAGE_SIZE }),
    enabled: hasActiveWards,
  });

  const items = data?.content ?? [];
  const filteredItems =
    triggerTypeFilter === 'ALL' ? items : items.filter(item => item.triggerType === triggerTypeFilter);

  const sosButtonCount = items.filter(item => item.triggerType === 'SOS_BUTTON').length;
  const guardianCallCount = items.filter(item => item.triggerType === 'GUARDIAN_CALL').length;

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
        <div className={cx('wardTabs')} role="tablist" aria-label="피보호자 선택">
          <button
            type="button"
            role="tab"
            aria-selected={effectiveSelectedWardId === null}
            className={cx('allWardTab', { allWardTabActive: effectiveSelectedWardId === null })}
            onClick={() => handleSelectWard(null)}
          >
            <span className={cx('wardAvatar')}>전</span>
            전체
          </button>
          <WardSelectorTabs
            wards={activeWards.map(ward => ({ wardId: ward.partnerUserId, wardName: ward.partnerName }))}
            selectedWardId={effectiveSelectedWardId ?? undefined}
            onSelect={handleSelectWard}
          />
        </div>
        <div className={cx('typeFilters')} role="tablist" aria-label="발생 경로 필터">
          {([
            ['ALL', '전체', items.length],
            ['GUARDIAN_CALL', '보호자에게 알림', guardianCallCount],
            ['SOS_BUTTON', '긴급 SOS 버튼', sosButtonCount],
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
          <div className={cx('tableHead')}>
            <span>언제</span>
            <span>어디서</span>
            <span>누구에게 연락</span>
            <span>피보호자</span>
          </div>
          {filteredItems.length === 0 ? (
            <div className={cx('emptyState')}>해당 조건의 호출 기록이 없습니다.</div>
          ) : (
            <ul className={cx('list')}>
              {filteredItems.map((item: IGuardianSosHistoryItem) => (
                <li key={item.sosEventId} className={cx('item')}>
                  <div className={cx('dateCell')}>
                    <strong>{formatSosDate(item.triggeredAt)}</strong>
                    <span>{formatTime(item.triggeredAt)}</span>
                  </div>
                  <div className={cx('locationCell')}>
                    <Icon name="mapPin" size={16} color="var(--sb-ink-mute)" />
                    <span>{item.location ?? '-'}</span>
                  </div>
                  <div>
                    <span className={cx('contactBadge', TRIGGER_TYPE_META[item.triggerType].tone)}>
                      <Icon name={TRIGGER_TYPE_META[item.triggerType].icon} size={15} />
                      {TRIGGER_TYPE_META[item.triggerType].label}
                    </span>
                  </div>
                  <span className={cx('wardName')}>{item.wardName ?? UNKNOWN_WARD_NAME}</span>
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
