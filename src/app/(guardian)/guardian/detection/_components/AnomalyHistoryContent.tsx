'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import {
  guardianAnomalyHistoryQueryOptions,
  guardianAnomalyReminderSettingQueryOptions,
  useUpdateAnomalyReminderSettingMutation,
} from '@/service/query/guardian/anomaly';
import { guardianConnectionsQueryOptions } from '@/service/query/guardian';
import { AnomalyDetectedType } from '@/service/interface/guardian/anomaly';
import { getConnectionData } from '@/components/connections/ConnectionShared';
import { WardSelectorTabs } from '@/components/connections/WardSelectorTabs';
import { AnomalyIncidentCard } from './AnomalyIncidentCard';
import styles from './AnomalyHistoryContent.module.css';

const cx = classNames.bind(styles);

const PAGE_SIZE = 12;
type TypeFilter = 'ALL' | AnomalyDetectedType;

export function AnomalyHistoryContent({ onViewLive }: { onViewLive: () => void }) {
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [selectedWardId, setSelectedWardId] = useState<string | undefined>(undefined);

  const { data: connectionsData } = useQuery(guardianConnectionsQueryOptions);
  const wards = getConnectionData(connectionsData)
    .filter(connection => connection.status === 'ACTIVE')
    .map(connection => ({ wardId: connection.partnerUserId, wardName: connection.partnerName }));
  const activeWardId = selectedWardId ?? wards[0]?.wardId;

  const { data, isLoading, isError } = useQuery(
    guardianAnomalyHistoryQueryOptions({ page, size: PAGE_SIZE, wardId: activeWardId }),
  );
  const { data: reminderSetting } = useQuery(guardianAnomalyReminderSettingQueryOptions);
  const reminderMutation = useUpdateAnomalyReminderSettingMutation();

  const content = data?.content ?? [];
  const filtered = useMemo(
    () => (typeFilter === 'ALL' ? content : content.filter(incident => incident.detectedType === typeFilter)),
    [content, typeFilter],
  );

  const fallCount = content.filter(incident => incident.detectedType === 'FALL').length;
  const fireCount = content.filter(incident => incident.detectedType === 'FIRE').length;
  const weaponCount = content.filter(incident => incident.detectedType === 'WEAPON').length;

  return (
    <section className={cx('page')}>
      <header className={cx('header')}>
        <button type="button" className={cx('liveButton')} onClick={onViewLive}>
          <span className={cx('liveDot')} />
          실시간 카메라 보기
        </button>
      </header>

      {wards.length > 0 && (
        <WardSelectorTabs
          wards={wards}
          selectedWardId={activeWardId}
          onSelect={wardId => {
            setSelectedWardId(wardId);
            setPage(0);
          }}
        />
      )}

      <div className={cx('filterRow')}>
        <button
          type="button"
          className={cx('chip', { active: typeFilter === 'ALL' })}
          onClick={() => setTypeFilter('ALL')}
        >
          전체 <span>{content.length}</span>
        </button>
        <button
          type="button"
          className={cx('chip', { active: typeFilter === 'FALL' })}
          onClick={() => setTypeFilter('FALL')}
        >
          낙상 <span>{fallCount}</span>
        </button>
        <button
          type="button"
          className={cx('chip', { active: typeFilter === 'FIRE' })}
          onClick={() => setTypeFilter('FIRE')}
        >
          화재 <span>{fireCount}</span>
        </button>
        <button
          type="button"
          className={cx('chip', { active: typeFilter === 'WEAPON' })}
          onClick={() => setTypeFilter('WEAPON')}
        >
          흉기 <span>{weaponCount}</span>
        </button>
      </div>
      <p className={cx('filterHint')}>필터·통계는 현재 불러온 {content.length}건 기준입니다.</p>

      <div className={cx('reminderBlock')}>
        <label className={cx('reminderField')}>
          <input
            type="checkbox"
            checked={reminderSetting?.reviewReminderEnabled ?? true}
            disabled={reminderMutation.isPending}
            onChange={event => reminderMutation.mutate({ reviewReminderEnabled: event.target.checked })}
          />
          확인 요청 알림 받기
        </label>
        <p className={cx('reminderHint')}>
          응답하지 않은 이상감지에 대해 확인을 요청합니다. 이상감지 발생 알림은 이 설정과 무관하게 항상 발송됩니다.
        </p>
      </div>

      {isLoading && <p className={cx('emptyText')}>감지 이력을 불러오는 중입니다.</p>}
      {isError && <p className={cx('emptyText')}>감지 이력을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && filtered.length === 0 && (
        <p className={cx('emptyText')}>해당하는 감지 이력이 없습니다.</p>
      )}

      {filtered.length > 0 && (
        <ul className={cx('grid')}>
          {filtered.map(incident => (
            <AnomalyIncidentCard key={incident.incidentId} incident={incident} />
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <div className={cx('pagination')}>
          <button type="button" disabled={page === 0} onClick={() => setPage(current => Math.max(current - 1, 0))}>
            이전
          </button>
          <span>
            {data.page + 1} / {data.totalPages}
          </span>
          <button type="button" disabled={data.last} onClick={() => setPage(current => current + 1)}>
            다음
          </button>
        </div>
      )}
    </section>
  );
}
