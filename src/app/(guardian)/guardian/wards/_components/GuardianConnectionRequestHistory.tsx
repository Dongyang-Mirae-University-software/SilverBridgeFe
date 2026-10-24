'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { getConnectionData, getErrorMessage } from '@/components/connections/ConnectionShared';
import { guardianConnectionRequestsQueryOptions, useGuardianConnectionCancelMutation } from '@/service/query/guardian';
import { formatMonthDay, formatRequestedAs } from '@/utils/connection/connectionView';
import styles from './GuardianConnectionRequestHistory.module.css';

const cx = classNames.bind(styles);

// 수락을 기다리는 요청 - 회원 ID·관계·요청일과 요청 취소. 수락 전이라 상대 연락처는 싣지 않는다
export function GuardianConnectionRequestHistory() {
  const { data, isError } = useQuery(guardianConnectionRequestsQueryOptions);
  const cancelMutation = useGuardianConnectionCancelMutation();
  const [errorMessage, setErrorMessage] = useState('');
  const pendingConnections = getConnectionData(data).filter(connection => connection.status === 'PENDING');

  const handleCancel = (connectionId: number) => {
    setErrorMessage('');
    cancelMutation.mutate(connectionId, {
      onError: error => setErrorMessage(getErrorMessage(error, '요청을 취소하지 못했어요.')),
    });
  };

  if (isError) return <p className={cx('loadError')}>보낸 요청을 불러오지 못했어요.</p>;
  if (pendingConnections.length === 0 && !errorMessage) return null;

  return (
    <section className={cx('card')} aria-labelledby="pending-requests-title">
      <h2 id="pending-requests-title" className={cx('title')}>
        수락을 기다리는 중
      </h2>
      {errorMessage && (
        <p className={cx('errorMessage')} role="alert">
          {errorMessage}
        </p>
      )}
      <ul className={cx('list')}>
        {pendingConnections.map(connection => {
          const requestedOn = formatMonthDay(connection.createdAt);
          return (
            <li key={connection.id} className={cx('row')}>
              <span className={cx('memberId')}>{connection.partnerUserId}</span>
              <span className={cx('meta')}>
                {formatRequestedAs(connection.relation)}
                {requestedOn && ` · ${requestedOn}`}
              </span>
              <button
                className={cx('cancelButton')}
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => handleCancel(connection.id)}
              >
                요청 취소
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
