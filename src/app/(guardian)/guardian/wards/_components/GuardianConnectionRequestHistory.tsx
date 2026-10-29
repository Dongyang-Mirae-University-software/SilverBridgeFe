'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { getConnectionData } from '@/components/connections/ConnectionShared';
import { guardianConnectionRequestsQueryOptions, useGuardianConnectionCancelMutation } from '@/service/query/guardian';
import { formatMonthDay, getConnectionActionErrorMessage } from '@/utils/connection/connectionView';
import styles from './GuardianConnectionRequestHistory.module.css';

const cx = classNames.bind(styles);

// 취소 실패 안내는 잠시만 보여 준다 - 목록이 새로 고쳐진 뒤까지 남아 빈 칸을 붙들지 않게
const NOTICE_MS = 6000;

// 수락을 기다리는 요청 - 회원 ID·관계·요청일과 요청 취소. 수락 전이라 상대 연락처는 싣지 않는다
export function GuardianConnectionRequestHistory() {
  const { data, isError } = useQuery(guardianConnectionRequestsQueryOptions);
  const cancelMutation = useGuardianConnectionCancelMutation();
  const [errorMessage, setErrorMessage] = useState('');
  const pendingConnections = getConnectionData(data).filter(connection => connection.status === 'PENDING');

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(''), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const handleCancel = (connectionId: number) => {
    setErrorMessage('');
    cancelMutation.mutate(connectionId, {
      // 피보호자가 먼저 수락·거절했으면 409 - 사실대로 안내하고 목록은 onSettled 재조회가 맞춘다
      onError: error => setErrorMessage(getConnectionActionErrorMessage(error, '요청을 취소하지 못했어요.')),
    });
  };

  const notice = errorMessage && (
    <p className={cx('errorMessage')} role="alert">
      {errorMessage}
    </p>
  );

  if (isError) return <p className={cx('loadError')}>보낸 요청을 불러오지 못했어요.</p>;
  // 대기 요청이 없으면 칸을 그리지 않는다 - 취소 실패 안내만 한 줄 남긴다
  if (pendingConnections.length === 0) return notice || null;

  return (
    <section className={cx('card')} aria-labelledby="pending-requests-title">
      <h2 id="pending-requests-title" className={cx('title')}>
        수락을 기다리는 중
      </h2>
      {notice}
      <ul className={cx('list')}>
        {pendingConnections.map(connection => {
          const requestedOn = formatMonthDay(connection.createdAt);
          return (
            <li key={connection.id} className={cx('row')}>
              <UserAvatar imageUrl={connection.partnerProfileImage} size="w-48" userName={connection.partnerName} />
              <div className={cx('requestInfo')}>
                <strong>{connection.partnerName || '이름 확인 전'}</strong>
                <span>{[connection.relation && `${connection.relation}로 요청`, requestedOn].filter(Boolean).join(' · ')}</span>
              </div>
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
