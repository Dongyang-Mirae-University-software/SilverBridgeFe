'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { Tabs } from '@/components/Tabs';
import { useGuardianActiveWards } from '@/hooks/useActiveConnections';
import { formatDay, formatMonth, formatTime } from '@/utils/format/date';
import { guardianSosHistoryQueryOptions } from '@/service/query/guardian';
import type { IGuardianSosHistoryItem, SosTriggerType } from '@/service/interface/guardian/sosHistory';
import styles from './GuardianSosHistoryContent.module.css';

const cx = classNames.bind(styles);
const PAGE_SIZE = 50;
const UNKNOWN_WARD_NAME = '탈퇴한 사용자';

const TRIGGER_TYPE_LABEL: Record<SosTriggerType, string> = {
  SOS_BUTTON: '긴급 SOS 버튼',
  GUARDIAN_CALL: '보호자에게 직접 전화',
};

type TriggerTypeFilter = 'ALL' | SosTriggerType;

interface GuardianSosHistoryStatsProps {
  guardianCallCount: number;
  sosButtonCount: number;
  totalElements?: number;
}

function formatCount(count: number) {
  return count > 0 ? `${count}건` : '-';
}

function GuardianSosHistoryStats({ guardianCallCount, sosButtonCount, totalElements }: GuardianSosHistoryStatsProps) {
  return (
    <div className={cx('statRow')}>
      <div className={cx('statCard')}>
        <span className={cx('statIcon')} aria-hidden="true">
          <Icon name="phone" size={18} decorative />
        </span>
        <strong>{totalElements ?? '-'} 건</strong>
        <span>전체 호출</span>
      </div>
      <div className={cx('statCard')}>
        <span className={cx('statIcon')} aria-hidden="true">
          <Icon name="users" size={18} decorative />
        </span>
        <strong>{formatCount(guardianCallCount)}</strong>
        <span>보호자에게 직접 전화</span>
      </div>
      <div className={cx('statCard')}>
        <span className={cx('statIcon')} aria-hidden="true">
          <Icon name="alert" size={18} decorative />
        </span>
        <strong>{formatCount(sosButtonCount)}</strong>
        <span>긴급 SOS 버튼</span>
      </div>
    </div>
  );
}

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
  const listHeading = selectedWard ? `${selectedWard.partnerName} 님 호출 기록` : '전체 호출 기록';

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
      <div className={cx('topRow')}>
        {activeWards.length > 0 && (
          <div className={cx('wardTabs')} role="tablist" aria-label="피보호자 선택">
            <button
              type="button"
              className={cx('wardTab', { wardTabActive: effectiveSelectedWardId === null })}
              onClick={() => handleSelectWard(null)}
            >
              전체
            </button>
            {activeWards.map(ward => (
              <button
                key={ward.partnerUserId}
                type="button"
                className={cx('wardTab', { wardTabActive: effectiveSelectedWardId === ward.partnerUserId })}
                onClick={() => handleSelectWard(ward.partnerUserId)}
              >
                {ward.partnerName} 님
              </button>
            ))}
          </div>
        )}
      </div>

      <GuardianSosHistoryStats
        totalElements={data?.totalElements}
        guardianCallCount={guardianCallCount}
        sosButtonCount={sosButtonCount}
      />

      <Tabs
        ariaLabel="발생 경로 필터"
        items={[
          { value: 'ALL', label: `전체 ${items.length}` },
          { value: 'GUARDIAN_CALL', label: `보호자에게 연락 ${guardianCallCount}` },
          { value: 'SOS_BUTTON', label: `긴급 SOS 버튼 ${sosButtonCount}` },
        ]}
        onChange={setTriggerTypeFilter}
        value={triggerTypeFilter}
      />

      <h2 className={cx('listHeading')}>{listHeading}</h2>

      {isError ? (
        <div className={cx('emptyState')}>
          <strong>SOS 이력을 불러오지 못했습니다.</strong>
          <span>잠시 후 다시 시도해주세요.</span>
        </div>
      ) : isLoading ? (
        <div className={cx('emptyState')}>
          <strong>SOS 이력을 불러오는 중입니다.</strong>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={cx('emptyState')}>
          <strong>표시할 SOS 이력이 없습니다.</strong>
          <span>연결된 피보호자에게 SOS가 발생하면 이곳에 표시됩니다.</span>
        </div>
      ) : (
        <ul className={cx('list')}>
          {filteredItems.map((item: IGuardianSosHistoryItem) => (
            <li
              key={item.sosEventId}
              className={cx('item', {
                itemGuardianCall: item.triggerType === 'GUARDIAN_CALL',
                itemSosButton: item.triggerType === 'SOS_BUTTON',
              })}
            >
              <div className={cx('itemDate')}>
                <strong>{formatDay(item.triggeredAt)}</strong>
                <span>{formatMonth(item.triggeredAt)}</span>
              </div>

              <div className={cx('itemBody')}>
                <span className={cx('itemTime')}>
                  {formatTime(item.triggeredAt)}
                  {item.location ? ` · 📍 ${item.location}` : ''}
                </span>
                <span className={cx('itemMeta')}>
                  {item.wardName ?? UNKNOWN_WARD_NAME} · {TRIGGER_TYPE_LABEL[item.triggerType]}
                </span>
              </div>

              <span
                className={cx('itemBadge', {
                  itemBadgeGuardianCall: item.triggerType === 'GUARDIAN_CALL',
                  itemBadgeSosButton: item.triggerType === 'SOS_BUTTON',
                })}
              >
                {TRIGGER_TYPE_LABEL[item.triggerType]}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        hasPrevPage={hasPrevPage}
        hasNextPage={hasNextPage}
        disabled={isFetching}
        onChange={setPage}
      />
    </div>
  );
}
