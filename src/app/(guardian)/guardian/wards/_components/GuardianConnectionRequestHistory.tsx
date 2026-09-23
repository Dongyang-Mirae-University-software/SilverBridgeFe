'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { guardianConnectionRequestsQueryOptions } from '@/service/query/guardian';
import { getConnectionData } from '@/components/connections/ConnectionShared';
import styles from './GuardianConnectionRequestHistory.module.css';

const cx = classNames.bind(styles);

function formatRequestDate(value: string | null) {
  if (!value) return '확인 전';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '확인 전';

  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date);
}

export function GuardianConnectionRequestHistory() {
  const { data, isLoading } = useQuery(guardianConnectionRequestsQueryOptions);
  const pendingConnections = getConnectionData(data).filter(connection => connection.status === 'PENDING');

  return (
    <section className={cx('card')}>
      <header className={cx('header')}>
        <div>
          <strong>요청 내역</strong>
          <p>수락 대기 중인 연결 요청을 확인합니다.</p>
        </div>
        <span>{pendingConnections.length}건</span>
      </header>

      {isLoading && <p className={cx('emptyText')}>요청 내역을 불러오는 중입니다.</p>}
      {!isLoading && pendingConnections.length === 0 && (
        <p className={cx('emptyText')}>수락 대기 중인 요청이 없습니다.</p>
      )}

      {pendingConnections.length > 0 && (
        <div className={cx('table')}>
          <div className={cx('tableHead')}>
            <span>회원 ID</span>
            <span>이름</span>
            <span>관계</span>
            <span>요청일</span>
          </div>
          <ul className={cx('list')}>
            {pendingConnections.map(connection => (
              <li key={connection.id} className={cx('item')}>
                <span className={cx('cell', 'mono')}>{connection.partnerUserId || '확인 전'}</span>
                <span className={cx('cell')}>{connection.partnerName || '확인 전'}</span>
                <span className={cx('cell')}>{connection.relation || '정보 없음'}</span>
                <span className={cx('cell')}>{formatRequestDate(connection.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
