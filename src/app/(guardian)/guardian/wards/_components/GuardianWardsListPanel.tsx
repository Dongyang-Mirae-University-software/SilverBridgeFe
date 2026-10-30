'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { RefreshButton } from '@/components/RefreshButton';
import { UserAvatar } from '@/components/UserAvatar';
import { useModalDialog } from '@/hooks/useModalDialog';
import { disconnectGuardianConnection } from '@/service/api/guardian/connection';
import { IConnectionItem } from '@/service/interface/connection';
import { guardianConnectionsQueryOptions } from '@/service/query/guardian';
import { EmptyState, getConnectionData } from '@/components/connections/ConnectionShared';
import {
  getAgeFromBirthDate,
  getConnectionActionErrorMessage,
} from '@/utils/connection/connectionView';
import { formatPhoneNumber } from '@/utils/format/phone';
import { GuardianPendingRequestCard, useGuardianPendingRequests } from './GuardianConnectionRequestHistory';
import styles from './GuardianWardsListPanel.module.css';

const cx = classNames.bind(styles);

/* v12 표시 보관: 성별·생년월일 행에 쓰던 날짜 변환이다.
function formatBirthDate(value?: string | null) {
  return value ? value.slice(0, 10).replaceAll('-', '.') : null;
}
*/

// Claude 디자인 시안: 카드 보조 정보는 만 나이만 보여 준다(성별은 연결 데이터에만 남긴다). 모르면 줄을 숨긴다
function getWardSubtitle(connection: IConnectionItem) {
  const age = getAgeFromBirthDate(connection.partnerBirthDate);
  return age === null ? null : `만 ${age}세`;
}

// v13 이전의 표 형태 정보 행 보관. 현재는 전화·주소를 아이콘 패널로 보여 준다.
/*
function getWardRows(connection: IConnectionItem): Array<[string, string]> {
  const address = [connection.partnerAddress, connection.partnerAddressDetail].filter(Boolean).join(' ');
  const rows: Array<[string, string | null | undefined]> = [
    ['전화번호', connection.partnerPhone ? formatPhoneNumber(connection.partnerPhone) : null],
    ['주소', address ? `${connection.partnerPostcode ? `(${connection.partnerPostcode}) ` : ''}${address}` : null],
    // v12 보관: 이메일·성별·생년월일·회원 ID는 연결 데이터에는 남기되 v13 카드에서는 노출하지 않는다.
    // ['이메일', connection.partnerEmail],
    // ['성별 · 생년월일', genderAndBirth],
    // ['회원 ID', connection.partnerUserId],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}
*/

function getWardContactInfo(connection: IConnectionItem) {
  // 시안대로 우편번호 없이 "주소, 상세주소"로 보여 준다
  const address = [connection.partnerAddress, connection.partnerAddressDetail].filter(Boolean).join(', ');
  return {
    phone: connection.partnerPhone ? formatPhoneNumber(connection.partnerPhone) : null,
    address: address || null,
  };
}

// 연결 해제 확인 창 - 열릴 때만 그려서 포커스 가두기·복귀·Esc를 useModalDialog에 맡긴다
function GuardianDisconnectDialog({
  ward,
  isPending,
  onCancel,
  onConfirm,
}: {
  ward: IConnectionItem;
  isPending: boolean;
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
        aria-labelledby="guardian-disconnect-title"
        onKeyDown={onDialogKeyDown}
      >
        <h3 id="guardian-disconnect-title" className={cx('modalTitle')}>
          연결을 해제할까요?
        </h3>
        <p className={cx('modalDesc')}>
          <strong>{ward.partnerName} 님</strong>과의 연결을 해제하면
          <br />이 분에 대한 알림을 더 이상 받지 않아요.
        </p>
        <div className={cx('modalActions')}>
          <button className={cx('modalCancel')} type="button" data-autofocus onClick={onCancel}>
            취소
          </button>
          <button className={cx('modalDanger')} type="button" disabled={isPending} onClick={onConfirm}>
            {isPending ? '해제 중…' : '연결 해제'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GuardianWardsListPanel() {
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const { data, isLoading, isError, refetch } = useQuery(guardianConnectionsQueryOptions);
  const pendingRequests = useGuardianPendingRequests();
  const activeConnections = getConnectionData(data).filter(connection => connection.status === 'ACTIVE');
  const isListReady = !isLoading && !isError;
  // 창은 id로 목록에서 다시 찾는다 - 열린 사이 상대가 먼저 해제해 목록에서 빠지면 창도 닫힌다
  const confirmTarget = activeConnections.find(connection => connection.id === confirmId) ?? null;

  const disconnectMutation = useMutation({
    mutationKey: ['guardian-connection-disconnect'],
    mutationFn: disconnectGuardianConnection,
    onMutate: () => setFeedbackMessage(''),
    onSettled: () => {
      setConfirmId(null);
      // 해제된 피보호자의 대시보드·복약·이상감지 화면도 남지 않게 떠 있는 쿼리를 모두 다시 받는다
      // (성공이든 이미 해제됨(409)이든 목록은 서버 기준으로 맞춘다)
      return queryClient.invalidateQueries();
    },
    onError: error => setFeedbackMessage(getConnectionActionErrorMessage(error, '연결 해제에 실패했어요.')),
  });

  return (
    <section className={cx('page')}>
      <div className={cx('pageHead')}>
        <h1>연결된 가족</h1>
        {isListReady && <span className={cx('pageCount')}>{activeConnections.length}명</span>}
      </div>

      {feedbackMessage && (
        <p className={cx('feedback')} role="alert">
          {feedbackMessage}
        </p>
      )}
      {pendingRequests.errorMessage && (
        <p className={cx('feedback')} role="alert">
          {pendingRequests.errorMessage}
        </p>
      )}
      {isLoading && <EmptyState message="연결된 가족을 불러오는 중입니다." />}
      {isError && <EmptyState message="연결된 가족을 불러오지 못했습니다." />}
      {isListReady && activeConnections.length === 0 && <EmptyState message="아직 연결된 가족이 없습니다." />}
      {pendingRequests.isError && <p className={cx('loadError')}>보낸 요청을 불러오지 못했어요.</p>}

      {/* 시안: 연결된 가족 → 수락을 기다리는 요청 → 가족 등록 타일을 한 그리드에 둔다 */}
      {isListReady && (
        <ul className={cx('grid')} aria-label="연결된 가족">
          {activeConnections.map(connection => {
            const subtitle = getWardSubtitle(connection);
            const contact = getWardContactInfo(connection);
            return (
              <li key={connection.id} className={cx('card')}>
                <div className={cx('cardHead')}>
                  <UserAvatar imageUrl={connection.partnerProfileImage} size="w-56" userName={connection.partnerName} />
                  <div className={cx('cardTitle')}>
                    <strong className={cx('cardName')}>{connection.partnerName} 님</strong>
                    {subtitle && <span className={cx('cardSub')}>{subtitle}</span>}
                  </div>
                </div>
                {(contact.phone || contact.address) && (
                  <div className={cx('contactPanel')}>
                    {contact.phone && <ContactInfo icon="phone" value={contact.phone} strong />}
                    {contact.address && <ContactInfo icon="mapPin" value={contact.address} />}
                  </div>
                )}
                <button className={cx('disconnectButton')} type="button" onClick={() => setConfirmId(connection.id)}>
                  연결 해제
                </button>
              </li>
            );
          })}
          {pendingRequests.pendingConnections.map(connection => (
            <GuardianPendingRequestCard
              key={connection.id}
              connection={connection}
              disabled={pendingRequests.isCancelPending}
              onCancel={() => pendingRequests.cancel(connection.id)}
            />
          ))}
          <li className={cx('registerItem')}>
            <Link className={cx('registerTile')} href="/guardian/wards/register">
              <span className={cx('registerIcon')}>
                <Icon name="plus" size={24} decorative />
              </span>
              가족 등록
            </Link>
          </li>
        </ul>
      )}

      <RefreshButton ariaLabel="새로고침" disabled={isLoading} onRefresh={() => refetch()} />

      {confirmTarget && (
        <GuardianDisconnectDialog
          ward={confirmTarget}
          isPending={disconnectMutation.isPending}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => disconnectMutation.mutate(confirmTarget.id)}
        />
      )}
    </section>
  );
}

function ContactInfo({ icon, value, strong = false }: { icon: 'phone' | 'mapPin'; value: string; strong?: boolean }) {
  return (
    <div className={cx('contactInfo', { contactStrong: strong })}>
      <Icon name={icon} size={17} decorative />
      <span>{value}</span>
    </div>
  );
}
