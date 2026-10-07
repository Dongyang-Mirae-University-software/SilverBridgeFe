'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { guardianConnectionRequestsQueryOptions } from '@/service/query/guardian';
import { getConnectionData, getConnectionStatusLabel } from '@/components/connections/ConnectionShared';
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
      <h2 className={cx('title')}>요청 내역</h2>

      {isLoading && <p className={cx('emptyText')}>요청 내역을 불러오는 중입니다.</p>}
      {!isLoading && pendingConnections.length === 0 && (
        <p className={cx('emptyText')}>수락 대기 중인 요청이 없습니다.</p>
      )}

      {pendingConnections.length > 0 && (
        <table className={cx('table')}>
          <thead>
            <tr>
              <th>회원 ID</th>
              <th>이름</th>
              <th>관계</th>
              <th>요청일</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {pendingConnections.map(connection => (
              <tr key={connection.id}>
                <td className={cx('mono')}>{connection.partnerUserId || '확인 전'}</td>
                <td>{connection.partnerName || '확인 전'}</td>
                <td>{connection.relation || '정보 없음'}</td>
                <td>{formatRequestDate(connection.createdAt)}</td>
                <td>
                  <span className={cx('statusBadge')}>⏳ {getConnectionStatusLabel(connection.status)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
