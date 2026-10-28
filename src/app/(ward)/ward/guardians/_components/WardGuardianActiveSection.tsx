'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { useModalDialog } from '@/hooks/useModalDialog';
import { getConnectionData } from '@/components/connections/ConnectionShared';
import { IConnectionItem } from '@/service/interface/connection';
import { useWardConnectionDisconnectMutation, useWardGuardianActiveConnectionsQuery } from '@/service/query/ward';
import { formatPhoneNumber } from '@/utils/format/phone';
import styles from './WardGuardianActiveSection.module.css';

const cx = classNames.bind(styles);

// v13은 한 사람을 한 줄로 보이게 한다. 연락처 이외의 상세 정보는 연결 데이터에만 유지한다.
function getGuardianPhone(connection: IConnectionItem) {
  return connection.partnerPhone ? formatPhoneNumber(connection.partnerPhone) : null;
}

/* v12 상세 카드 보관: 이메일·회원 ID·연결일은 API 데이터에 남아 있지만 v13 목록에서는 표시하지 않는다.
function getGuardianRows(connection: IConnectionItem): Array<[string, string]> {
  const rows: Array<[string, string | null | undefined]> = [
    ['전화번호', connection.partnerPhone ? formatPhoneNumber(connection.partnerPhone) : null],
    ['이메일', connection.partnerEmail],
    ['회원 ID', connection.partnerUserId],
    ['연결한 날', formatKoreanDate(connection.connectedAt)],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}
*/

// 연결 끊기 확인 창 - 열릴 때만 그려서 포커스 가두기·복귀·Esc를 useModalDialog에 맡긴다
function WardDisconnectDialog({
  guardian,
  onCancel,
  onConfirm,
}: {
  guardian: IConnectionItem;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { dialogRef, onDialogKeyDown, overlayProps } = useModalDialog<HTMLDivElement>({
    onRequestClose: onCancel,
    initialFocusSelector: '[data-autofocus]',
  });

  return (
    <div className={cx('overlay')} {...overlayProps}>
      <div
        ref={dialogRef}
        className={cx('modal')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ward-disconnect-title"
        onKeyDown={onDialogKeyDown}
      >
        <h2 id="ward-disconnect-title" className={cx('modalTitle')}>
          {guardian.partnerName} 님과 연결을 끊을까요?
        </h2>
        <p className={cx('modalDesc')}>끊으면 SOS를 눌러도 이 분께 알림이 가지 않아요</p>
        <div className={cx('modalActions')}>
          <button className={cx('keepButton')} type="button" data-autofocus onClick={onCancel}>
            그대로 두기
          </button>
          <button className={cx('confirmButton')} type="button" onClick={onConfirm}>
            끊기
          </button>
        </div>
      </div>
    </div>
  );
}

export function WardGuardianActiveSection() {
  const activeQuery = useWardGuardianActiveConnectionsQuery();
  const disconnectMutation = useWardConnectionDisconnectMutation();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const guardians = getConnectionData(activeQuery.data);
  // 창은 id로 목록에서 다시 찾는다 - 열린 사이 상대가 먼저 해제해 목록에서 빠지면 창도 닫히고,
  // 새 연결은 새 id라 나중에 옛 창이 다시 뜨지 않는다
  const confirmTarget = guardians.find(guardian => guardian.id === confirmId) ?? null;

  const handleDisconnect = () => {
    if (!confirmTarget) return;
    disconnectMutation.mutate(confirmTarget.id);
    setConfirmId(null);
  };

  if (activeQuery.isLoading) return <p className={cx('emptyCard')}>보호자 목록을 불러오는 중이에요.</p>;
  if (activeQuery.isError) return <p className={cx('emptyCard')}>보호자 목록을 불러오지 못했어요.</p>;
  if (guardians.length === 0) return <p className={cx('emptyCard')}>아직 연결된 보호자가 없어요</p>;

  return (
    <>
      <ul className={cx('guardianList')} aria-label="연결된 보호자">
        {guardians.map(guardian => {
          const phone = getGuardianPhone(guardian);
          return (
          <li key={guardian.id} className={cx('guardianRow')}>
            <div className={cx('guardianHead')}>
              <UserAvatar imageUrl={guardian.partnerProfileImage} size="w-72" userName={guardian.partnerName} />
              <div className={cx('guardianInfo')}>
                <strong className={cx('guardianName')}>
                  {guardian.partnerName || '이름 확인 전'} 님
                  {guardian.relation && <span className={cx('relation')}> ({guardian.relation})</span>}
                </strong>
                {phone && <span className={cx('guardianPhone')}>{phone}</span>}
              </div>
            </div>
            <button
              className={cx('disconnectButton')}
              type="button"
              disabled={disconnectMutation.isPending}
              onClick={() => setConfirmId(guardian.id)}
            >
              연결 끊기
            </button>
          </li>
          );
        })}
      </ul>

      {confirmTarget && (
        <WardDisconnectDialog guardian={confirmTarget} onCancel={() => setConfirmId(null)} onConfirm={handleDisconnect} />
      )}
    </>
  );
}
