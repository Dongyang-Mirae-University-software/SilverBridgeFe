'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { formatDay, formatMonth, formatTime } from '@/lib/format/date';
import { guardianConnectionsQueryOptions } from '@/service/query/connection';
import { guardianSosHistoryQueryOptions } from '@/service/query/guardian';
import type { IGuardianSosHistoryItem, SosTriggerType } from '@/service/interface/sos';
import styles from './GuardianSosHistoryContent.module.css';

const cx = classNames.bind(styles);
const PAGE_SIZE = 50;
const UNKNOWN_WARD_NAME = '탈퇴한 사용자';

const TRIGGER_TYPE_LABEL: Record<SosTriggerType, string> = {
  SOS_BUTTON: '긴급 SOS 버튼',
  GUARDIAN_CALL: '보호자에게 직접 전화',
};

type TriggerTypeFilter = 'ALL' | SosTriggerType;

export default function GuardianSosHistoryContent() {
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<TriggerTypeFilter>('ALL');
  const [page, setPage] = useState(0);

  const { data: connectionsResponse } = useQuery(guardianConnectionsQueryOptions);
  const activeWards = useMemo(
    () => (connectionsResponse?.data ?? []).filter(connection => connection.status === 'ACTIVE'),
    [connectionsResponse],
  );

  const { data, isLoading, isError, isFetching } = useQuery(
    guardianSosHistoryQueryOptions({ wardId: selectedWardId ?? undefined, page, size: PAGE_SIZE }),
  );

  const items = data?.content ?? [];
  const filteredItems =
    triggerTypeFilter === 'ALL' ? items : items.filter(item => item.triggerType === triggerTypeFilter);
  const sosButtonCount = items.filter(item => item.triggerType === 'SOS_BUTTON').length;
  const guardianCallCount = items.filter(item => item.triggerType === 'GUARDIAN_CALL').length;
  const hasNextPage = data ? !data.last : false;
  const hasPrevPage = page > 0;
  const selectedWard = activeWards.find(ward => ward.partnerUserId === selectedWardId);
  const listHeading = selectedWard ? `${selectedWard.partnerName} 님 호출 기록` : '전체 호출 기록';

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
              className={cx('wardTab', { wardTabActive: selectedWardId === null })}
              onClick={() => handleSelectWard(null)}
            >
              전체
            </button>
            {activeWards.map(ward => (
              <button
                key={ward.partnerUserId}
                type="button"
                className={cx('wardTab', { wardTabActive: selectedWardId === ward.partnerUserId })}
                onClick={() => handleSelectWard(ward.partnerUserId)}
              >
                {ward.partnerName} 님
              </button>
            ))}
          </div>
        )}
      </div>

      {typeof data?.totalElements === 'number' && (
        <div className={cx('statRow')}>
          <div className={cx('statCard')}>
            <span className={cx('statIcon')} aria-hidden="true">
              <Icon name="phone" size={18} decorative />
            </span>
            <strong>{data.totalElements}건</strong>
            <span>전체 호출</span>
          </div>
          <div className={cx('statCard')}>
            <span className={cx('statIcon')} aria-hidden="true">
              <Icon name="users" size={18} decorative />
            </span>
            <strong>{guardianCallCount}건</strong>
            <span>보호자에게 직접 전화</span>
          </div>
          <div className={cx('statCard')}>
            <span className={cx('statIcon')} aria-hidden="true">
              <Icon name="alert" size={18} decorative />
            </span>
            <strong>{sosButtonCount}건</strong>
            <span>긴급 SOS 버튼</span>
          </div>
        </div>
      )}

      <div className={cx('filterTabs')} role="tablist" aria-label="발생 경로 필터">
        <button
          type="button"
          className={cx('filterTab', { filterTabActive: triggerTypeFilter === 'ALL' })}
          onClick={() => setTriggerTypeFilter('ALL')}
        >
          전체 {items.length}
        </button>
        <button
          type="button"
          className={cx('filterTab', { filterTabActive: triggerTypeFilter === 'GUARDIAN_CALL' })}
          onClick={() => setTriggerTypeFilter('GUARDIAN_CALL')}
        >
          보호자에게 연락 {guardianCallCount}
        </button>
        <button
          type="button"
          className={cx('filterTab', { filterTabActive: triggerTypeFilter === 'SOS_BUTTON' })}
          onClick={() => setTriggerTypeFilter('SOS_BUTTON')}
        >
          긴급 SOS 버튼 {sosButtonCount}
        </button>
      </div>

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

      {(hasPrevPage || hasNextPage) && (
        <div className={cx('pagination')}>
          <button
            className={cx('pageButton')}
            type="button"
            disabled={!hasPrevPage || isFetching}
            onClick={() => setPage(current => Math.max(0, current - 1))}
          >
            이전
          </button>
          <span className={cx('pageIndicator')}>{page + 1}</span>
          <button
            className={cx('pageButton')}
            type="button"
            disabled={!hasNextPage || isFetching}
            onClick={() => setPage(current => current + 1)}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
