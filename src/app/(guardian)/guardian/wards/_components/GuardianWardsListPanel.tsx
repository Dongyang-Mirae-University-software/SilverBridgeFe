'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { RefreshButton } from '@/components/RefreshButton';
import { UserAvatar } from '@/components/UserAvatar';
import { disconnectGuardianConnection } from '@/service/api/guardian/connection';
import { IConnectionItem } from '@/service/interface/connection';
import { guardianConnectionsQueryKey, guardianConnectionsQueryOptions } from '@/service/query/guardian';
import {
  EmptyState,
  formatPartnerGender,
  getConnectionData,
  getErrorMessage,
} from '@/components/connections/ConnectionShared';
import { formatRelationToWard, getAgeFromBirthDate } from '@/utils/connection/connectionView';
import { getAndParticle } from '@/utils/format/korean';
import { formatPhoneNumber } from '@/utils/format/phone';
import styles from './GuardianWardsListPanel.module.css';

const cx = classNames.bind(styles);

function formatBirthDate(value?: string | null) {
  return value ? value.slice(0, 10).replaceAll('-', '.') : null;
}

// "김영희의 아들 · 78세" - relation은 보호자(나)가 피보호자에게 누구인지라 문장으로 풀어 쓴다
function getWardSubtitle(connection: IConnectionItem) {
  const age = getAgeFromBirthDate(connection.partnerBirthDate);
  return [formatRelationToWard(connection.partnerName, connection.relation), age === null ? null : `${age}세`]
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

export function GuardianWardsListPanel() {
  const queryClient = useQueryClient();
  const [confirmTarget, setConfirmTarget] = useState<IConnectionItem | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const { data, isLoading, isError, refetch } = useQuery(guardianConnectionsQueryOptions);
  const activeConnections = getConnectionData(data).filter(connection => connection.status === 'ACTIVE');

  const disconnectMutation = useMutation({
    mutationKey: ['guardian-connection-disconnect'],
    mutationFn: disconnectGuardianConnection,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async () => {
      setConfirmTarget(null);
      await queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
    },
    onError: error => {
      setConfirmTarget(null);
      setFeedbackMessage(getErrorMessage(error, '연결 해제에 실패했어요.'));
    },
  });

  useEffect(() => {
    if (!confirmTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setConfirmTarget(null);
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [confirmTarget]);

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
                  <button className={cx('disconnectButton')} type="button" onClick={() => setConfirmTarget(connection)}>
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
        <div className={cx('overlay')} onClick={() => setConfirmTarget(null)}>
          <div
            className={cx('modal')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guardian-disconnect-title"
            onClick={event => event.stopPropagation()}
          >
            <div className={cx('modalIcon')}>
              <Icon name="alert" size={26} />
            </div>
            <h3 id="guardian-disconnect-title" className={cx('modalTitle')}>
              연결을 해제할까요?
            </h3>
            <p className={cx('modalDesc')}>
              <strong>{confirmTarget.partnerName}</strong>
              {getAndParticle(confirmTarget.partnerName)}의 연결을 해제하면
              <br />이 분에 대한 알림을 더 이상 받지 않아요.
            </p>
            <div className={cx('modalActions')}>
              <button className={cx('modalCancel')} type="button" autoFocus onClick={() => setConfirmTarget(null)}>
                취소
              </button>
              <button
                className={cx('modalDanger')}
                type="button"
                disabled={disconnectMutation.isPending}
                onClick={() => disconnectMutation.mutate(confirmTarget.id)}
              >
                {disconnectMutation.isPending ? '해제 중…' : '연결 해제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
