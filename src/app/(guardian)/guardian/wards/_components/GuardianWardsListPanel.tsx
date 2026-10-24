'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { RefreshButton } from '@/components/RefreshButton';
import { UserAvatar } from '@/components/UserAvatar';
import { useModalDialog } from '@/hooks/useModalDialog';
import { disconnectGuardianConnection } from '@/service/api/guardian/connection';
import { IConnectionItem } from '@/service/interface/connection';
import { guardianConnectionsQueryOptions } from '@/service/query/guardian';
import { EmptyState, formatPartnerGender, getConnectionData } from '@/components/connections/ConnectionShared';
import {
  formatRelationToWard,
  getAgeFromBirthDate,
  getConnectionActionErrorMessage,
} from '@/utils/connection/connectionView';
import { getAndParticle } from '@/utils/format/korean';
import { formatPhoneNumber } from '@/utils/format/phone';
import styles from './GuardianWardsListPanel.module.css';

const cx = classNames.bind(styles);

function formatBirthDate(value?: string | null) {
  return value ? value.slice(0, 10).replaceAll('-', '.') : null;
}

// "나는 김영희의 아들 · 78세" - relation은 보호자(나)가 피보호자에게 누구인지라, 카드 제목(김영희)을
// 설명하는 말로 읽히지 않게 주어를 드러낸다
function getWardSubtitle(connection: IConnectionItem) {
  const age = getAgeFromBirthDate(connection.partnerBirthDate);
  const relation = formatRelationToWard(connection.partnerName, connection.relation);
  return [relation ? `나는 ${relation}` : null, age === null ? null : `${age}세`]
    .filter(Boolean)
    .join(' · ');
}

// 연락처는 연결(ACTIVE) 뒤에만 온다. 빈 값은 "정보 없음"으로 채우지 않고 줄을 뺀다
function getWardRows(connection: IConnectionItem): Array<[string, string]> {
  const address = [connection.partnerAddress, connection.partnerAddressDetail].filter(Boolean).join(' ');
  const genderAndBirth = [formatPartnerGender(connection.partnerGender), formatBirthDate(connection.partnerBirthDate)]
    .filter(Boolean)
    .join(' · ');
  const rows: Array<[string, string | null | undefined]> = [
    ['전화번호', connection.partnerPhone ? formatPhoneNumber(connection.partnerPhone) : null],
    ['주소', address ? `${connection.partnerPostcode ? `(${connection.partnerPostcode}) ` : ''}${address}` : null],
    ['이메일', connection.partnerEmail],
    ['성별 · 생년월일', genderAndBirth],
    ['회원 ID', connection.partnerUserId],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
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
        <div className={cx('modalIcon')}>
          <Icon name="alert" size={26} />
        </div>
        <h3 id="guardian-disconnect-title" className={cx('modalTitle')}>
          연결을 해제할까요?
        </h3>
        <p className={cx('modalDesc')}>
          <strong>{ward.partnerName}</strong>
          {getAndParticle(ward.partnerName)}의 연결을 해제하면
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
  const activeConnections = getConnectionData(data).filter(connection => connection.status === 'ACTIVE');
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
      </div>

      {feedbackMessage && (
        <p className={cx('feedback')} role="alert">
          {feedbackMessage}
        </p>
      )}
      {isLoading && <EmptyState message="연결된 가족을 불러오는 중입니다." />}
      {isError && <EmptyState message="연결된 가족을 불러오지 못했습니다." />}
      {!isLoading && !isError && activeConnections.length === 0 && <EmptyState message="아직 연결된 가족이 없습니다." />}

      {activeConnections.length > 0 && (
        <ul className={cx('grid')} aria-label="연결된 가족">
          {activeConnections.map(connection => {
            const subtitle = getWardSubtitle(connection);
            return (
              <li key={connection.id} className={cx('card')}>
                <div className={cx('cardHead')}>
                  <UserAvatar imageUrl={connection.partnerProfileImage} size="w-60" userName={connection.partnerName} />
                  <div className={cx('cardTitle')}>
                    <strong className={cx('cardName')}>{connection.partnerName}</strong>
                    {subtitle && <span className={cx('cardSub')}>{subtitle}</span>}
                  </div>
                </div>
                <dl className={cx('rows')}>
                  {getWardRows(connection).map(([label, value]) => (
                    <div key={label} className={cx('row')}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className={cx('cardFooter')}>
                  <button className={cx('disconnectButton')} type="button" onClick={() => setConfirmId(connection.id)}>
                    연결 해제
                  </button>
                </div>
              </li>
            );
          })}
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
