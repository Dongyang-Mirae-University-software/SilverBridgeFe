'use client';

import { useEffect, useState } from 'react';
import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { getConnectionData } from '@/components/connections/ConnectionShared';
import { IConnectionItem } from '@/service/interface/connection';
import { useWardConnectionDisconnectMutation, useWardGuardianActiveConnectionsQuery } from '@/service/query/ward';
import { formatKoreanDate } from '@/utils/connection/connectionView';
import { getAndParticle } from '@/utils/format/korean';
import { formatPhoneNumber } from '@/utils/format/phone';
import styles from './WardGuardianActiveSection.module.css';

const cx = classNames.bind(styles);

// 값이 없는 줄은 "정보 없음"으로 채우지 않고 뺀다
function getGuardianRows(connection: IConnectionItem): Array<[string, string]> {
  const rows: Array<[string, string | null | undefined]> = [
    ['전화번호', connection.partnerPhone ? formatPhoneNumber(connection.partnerPhone) : null],
    ['이메일', connection.partnerEmail],
    ['회원 ID', connection.partnerUserId],
    ['연결한 날', formatKoreanDate(connection.connectedAt)],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

export function WardGuardianActiveSection() {
  const activeQuery = useWardGuardianActiveConnectionsQuery();
  const disconnectMutation = useWardConnectionDisconnectMutation();
  const [confirmTarget, setConfirmTarget] = useState<IConnectionItem | null>(null);
  const guardians = getConnectionData(activeQuery.data);

  useEffect(() => {
    if (!confirmTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setConfirmTarget(null);
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [confirmTarget]);

  const handleDisconnect = () => {
    if (!confirmTarget) return;
    disconnectMutation.mutate(confirmTarget.id);
    setConfirmTarget(null);
  };

  if (activeQuery.isLoading) return <p className={cx('emptyCard')}>보호자 목록을 불러오는 중이에요.</p>;
  if (activeQuery.isError) return <p className={cx('emptyCard')}>보호자 목록을 불러오지 못했어요.</p>;
  if (guardians.length === 0) return <p className={cx('emptyCard')}>아직 연결된 보호자가 없어요</p>;

  return (
    <>
      <ul className={cx('guardianGrid')} aria-label="연결된 보호자">
        {guardians.map(guardian => (
          <li key={guardian.id} className={cx('guardianCard')}>
            <div className={cx('guardianHead')}>
              <UserAvatar imageUrl={guardian.partnerProfileImage} size="w-72" userName={guardian.partnerName} />
              <strong className={cx('guardianName')}>
                {guardian.partnerName || '이름 확인 전'}
                {guardian.relation && <span className={cx('relation')}> ({guardian.relation})</span>}
              </strong>
            </div>
            <dl className={cx('rows')}>
              {getGuardianRows(guardian).map(([label, value]) => (
                <div key={label} className={cx('row')}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className={cx('cardFooter')}>
              <button
                className={cx('disconnectButton')}
                type="button"
                disabled={disconnectMutation.isPending}
                onClick={() => setConfirmTarget(guardian)}
              >
                연결 끊기
              </button>
            </div>
          </li>
        ))}
      </ul>

      {confirmTarget && (
        <div className={cx('overlay')} onClick={() => setConfirmTarget(null)}>
          <div
            className={cx('modal')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ward-disconnect-title"
            onClick={event => event.stopPropagation()}
          >
            <h2 id="ward-disconnect-title" className={cx('modalTitle')}>
              {confirmTarget.partnerName}
              {getAndParticle(confirmTarget.partnerName)} 연결을 끊을까요?
            </h2>
            <p className={cx('modalDesc')}>끊으면 SOS를 눌러도 이 분께 알림이 가지 않아요</p>
            <div className={cx('modalActions')}>
              <button className={cx('keepButton')} type="button" autoFocus onClick={() => setConfirmTarget(null)}>
                그대로 두기
              </button>
              <button className={cx('confirmButton')} type="button" onClick={handleDisconnect}>
                끊기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
