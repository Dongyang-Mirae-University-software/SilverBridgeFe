'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon, IconName } from '@/components/Icon';
import { RefreshButton } from '@/components/RefreshButton';
import { Tabs } from '@/components/Tabs';
import { disconnectGuardianConnection } from '@/service/api/guardian/connection';
import { IConnectionItem } from '@/service/interface/connection';
import { guardianConnectionsQueryKey, guardianConnectionsQueryOptions } from '@/service/query/guardian';
import {
  EmptyState,
  formatPartnerGender,
  getActivePartnerValue,
  getConnectionData,
  getConnectionStatusLabel,
  getErrorMessage,
  getPartnerPhoneValue,
} from '@/components/connections/ConnectionShared';
import styles from './GuardianWardsListPanel.module.css';

const cx = classNames.bind(styles);

type ListTab = 'list' | 'history';
const HISTORY_STATUSES: IConnectionItem['status'][] = ['REFUSED', 'CANCELLED', 'DISCONNECTED'];

function formatBirthDate(value?: string | null) {
  if (!value) return null;
  return value.replaceAll('-', '.');
}

function getWardRows(connection: IConnectionItem): Array<[IconName, string, string]> {
  return [
    ['handshake', '관계', connection.relation || '정보 없음'],
    ['phone', '전화번호', getPartnerPhoneValue(connection)],
    ['mapPin', '주소', getActivePartnerValue(connection, connection.partnerAddress)],
    ['mail', '이메일', getActivePartnerValue(connection, connection.partnerEmail)],
    ['user', '성별', formatPartnerGender(connection.partnerGender) ?? '정보 없음'],
    ['cake', '생년월일', getActivePartnerValue(connection, formatBirthDate(connection.partnerBirthDate))],
    ['tag', '우편번호', getActivePartnerValue(connection, connection.partnerPostcode)],
  ];
}

export function GuardianWardsListPanel() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ListTab>('list');
  const [confirmTarget, setConfirmTarget] = useState<IConnectionItem | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const { data, isLoading, isError, refetch } = useQuery(guardianConnectionsQueryOptions);
  const connections = getConnectionData(data);
  const activeConnections = connections.filter(connection => connection.status === 'ACTIVE');
  const historyConnections = connections.filter(connection => HISTORY_STATUSES.includes(connection.status));

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
      setFeedbackMessage(getErrorMessage(error, '연결 해제에 실패했습니다.'));
    },
  });

  return (
    <section className={cx('page')}>
      <div className={cx('pageHead')}>
        <div>
          <h1>피보호자 리스트</h1>
          <div className={cx('sub')}>현재 돌보고 있는 피보호자 {activeConnections.length}명</div>
        </div>
        <RefreshButton ariaLabel="새로고침" disabled={isLoading} onRefresh={() => refetch()} />
      </div>

      <Tabs
        ariaLabel="피보호자 리스트 탭"
        items={[
          { value: 'list', label: '목록' },
          { value: 'history', label: '종료 이력' },
        ]}
        onChange={setTab}
        size="sm"
        value={tab}
        variant="underline"
      />

      {tab === 'list' ? (
        <>
          {feedbackMessage && <p className={cx('feedback')}>{feedbackMessage}</p>}
          {isLoading && <EmptyState message="피보호자 목록을 불러오는 중입니다." />}
          {isError && <EmptyState message="피보호자 목록을 불러오지 못했습니다." />}
          {!isLoading && !isError && activeConnections.length === 0 && (
            <EmptyState message="아직 연결된 피보호자가 없습니다." />
          )}

          {activeConnections.length > 0 && (
            <div className={cx('grid')}>
              {activeConnections.map(connection => (
                <div key={connection.id} className={cx('card')}>
                  <div className={cx('avatar')}>
                    {connection.partnerProfileImage ? (
                      <img src={connection.partnerProfileImage} alt="" />
                    ) : (
                      connection.partnerName.charAt(0)
                    )}
                  </div>
                  <div className={cx('cardHead')}>
                    <span className={cx('cardName')}>{connection.partnerName}</span>
                    <span className={cx('statusBadge')}>{getConnectionStatusLabel(connection.status)}</span>
                  </div>
                  {getWardRows(connection).map(([icon, label, value]) => (
                    <div key={label} className={cx('row')}>
                      <Icon name={icon} size={18} className={cx('rowIcon')} />
                      <span className={cx('rowLabel')}>{label}</span>
                      <span className={cx('rowValue')} title={value}>
                        {value}
                      </span>
                    </div>
                  ))}
                  <div className={cx('cardFooter')}>
                    <button className={cx('disconnectButton')} type="button" onClick={() => setConfirmTarget(connection)}>
                      연결 해제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {historyConnections.length === 0 ? (
            <EmptyState message="종료된 연결 이력이 없습니다." />
          ) : (
            <ul className={cx('historyList')}>
              {historyConnections.map(connection => (
                <li key={connection.id} className={cx('historyItem')}>
                  <span className={cx('historyName')}>{connection.partnerName}</span>
                  <span className={cx('historyRelation')}>{connection.relation || '정보 없음'}</span>
                  <span className={cx('historyStatus')}>{getConnectionStatusLabel(connection.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {confirmTarget && (
        <div className={cx('overlay')} onClick={() => setConfirmTarget(null)}>
          <div className={cx('modal')} onClick={event => event.stopPropagation()}>
            <div className={cx('modalIcon')}>
              <Icon name="alert" size={26} />
            </div>
            <h3 className={cx('modalTitle')}>정말 연결을 해제할까요?</h3>
            <p className={cx('modalDesc')}>
              <strong>{confirmTarget.partnerName}</strong>님과의 연결이 해제되며 되돌릴 수 없습니다.
            </p>
            <div className={cx('modalActions')}>
              <button className={cx('modalCancel')} type="button" onClick={() => setConfirmTarget(null)}>
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
