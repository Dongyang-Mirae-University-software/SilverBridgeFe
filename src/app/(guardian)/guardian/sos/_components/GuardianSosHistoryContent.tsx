'use client';

import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { guardianSosHistoryQueryOptions } from '@/service/query/guardian';
import type { IGuardianSosHistoryItem } from '@/service/interface/sos';
import styles from './GuardianSosHistoryContent.module.css';

dayjs.locale('ko');

const cx = classNames.bind(styles);
const PAGE_SIZE = 20;

const TRIGGER_TYPE_LABEL: Record<IGuardianSosHistoryItem['triggerType'], string> = {
  SOS_BUTTON: '긴급 SOS 버튼',
  GUARDIAN_CALL: '보호자에게 직접 전화',
};

function formatTriggeredAt(value: string) {
  return dayjs(value).format('YYYY.MM.DD A h:mm');
}

export default function GuardianSosHistoryContent() {
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, isFetching } = useQuery(
    guardianSosHistoryQueryOptions({ page, size: PAGE_SIZE }),
  );

  const items = data?.content ?? [];
  const hasNextPage = data ? !data.last : false;
  const hasPrevPage = page > 0;

  return (
    <div className={cx('page')}>
      {typeof data?.totalElements === 'number' && (
        <p className={cx('summary')}>최근 SOS 이력 총 {data.totalElements}건</p>
      )}

      {isError ? (
        <div className={cx('emptyState')}>
          <strong>SOS 이력을 불러오지 못했습니다.</strong>
          <span>잠시 후 다시 시도해주세요.</span>
        </div>
      ) : isLoading ? (
        <div className={cx('emptyState')}>
          <strong>SOS 이력을 불러오는 중입니다.</strong>
        </div>
      ) : items.length === 0 ? (
        <div className={cx('emptyState')}>
          <strong>표시할 SOS 이력이 없습니다.</strong>
          <span>연결된 피보호자에게 SOS가 발생하면 이곳에 표시됩니다.</span>
        </div>
      ) : (
        <ul className={cx('list')}>
          {items.map(item => (
            <li key={item.sosEventId} className={cx('item')}>
              <span className={cx('itemIcon')} aria-hidden="true">
                <Icon name="alert" size={20} decorative />
              </span>
              <div className={cx('itemBody')}>
                <div className={cx('itemTitleRow')}>
                  <strong>{item.wardName}</strong>
                  <span className={cx('itemBadge')}>{TRIGGER_TYPE_LABEL[item.triggerType]}</span>
                </div>
                <span className={cx('itemMeta')}>
                  {formatTriggeredAt(item.triggeredAt)}
                  {item.location ? ` · 📍 ${item.location}` : ''}
                </span>
              </div>
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
