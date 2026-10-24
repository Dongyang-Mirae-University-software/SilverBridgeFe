'use client';

import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { UserAvatar } from '@/components/UserAvatar';
import { getConnectionData } from '@/components/connections/ConnectionShared';
import {
  useWardConnectionAcceptMutation,
  useWardConnectionRefuseMutation,
  useWardGuardianPendingConnectionsQuery,
} from '@/service/query/ward';
import styles from './WardGuardianPendingSection.module.css';

const cx = classNames.bind(styles);

// 보호자가 보낸 연결 요청. 수락 전이라 연락처는 보여 주지 않는다(BE도 가린 번호만 준다)
export function WardGuardianPendingSection() {
  const pendingQuery = useWardGuardianPendingConnectionsQuery();
  const acceptMutation = useWardConnectionAcceptMutation();
  const refuseMutation = useWardConnectionRefuseMutation();

  const requests = getConnectionData(pendingQuery.data);
  const isPending = acceptMutation.isPending || refuseMutation.isPending;

  if (pendingQuery.isError) {
    return <p className={cx('loadError')}>받은 연결 요청을 불러오지 못했어요.</p>;
  }
  if (requests.length === 0) return null;

  return (
    <ul className={cx('requestList')} aria-label="받은 연결 요청">
      {requests.map(request => (
        <li key={request.id} className={cx('requestCard')}>
          <UserAvatar imageUrl={request.partnerProfileImage} size="w-72" userName={request.partnerName} />
          <div className={cx('requestText')}>
            {/* relation은 보호자가 나에게 누구인지라 "박철수 (손자)"가 그대로 맞다 */}
            <strong className={cx('requestName')}>
              {request.partnerName || '이름 확인 전'}
              {request.relation && <span className={cx('relation')}> ({request.relation})</span>}
            </strong>
            <span className={cx('requestDesc')}>보호자가 되고 싶다고 요청했어요</span>
          </div>
          <div className={cx('requestActions')}>
            <button
              className={cx('refuseButton')}
              type="button"
              disabled={isPending}
              onClick={() => refuseMutation.mutate(request.id)}
            >
              거절
            </button>
            <button
              className={cx('acceptButton')}
              type="button"
              disabled={isPending}
              onClick={() => acceptMutation.mutate(request.id)}
            >
              <Icon name="check" size={22} decorative />
              수락
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
