'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { cancelGuardianConnectionRequest, disconnectGuardianConnection } from '@/service/api/connect/guardian';
import { IConnectionItem } from '@/service/interface/connection';
import { guardianConnectionsQueryKey, guardianConnectionsQueryOptions } from '@/service/query/connection';
import {
  EmptyState,
  getConnectionStatusClass,
  getConnectionStatusLabel,
  getConnectionData,
  getErrorMessage,
  formatPartnerGender,
  getActivePartnerValue,
  getPartnerPhoneValue,
  splitConnections,
} from './ConnectionShared';
import { GuardianWardRegisterPanel } from './GuardianWardRegisterPanel';
import styles from './GuardianWardsPanel.module.css';

const cx = classNames.bind(styles);

type GuardianWardsTab = 'list' | 'register';

export function GuardianWardsPanel() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [activeTab, setActiveTab] = useState<GuardianWardsTab>(() => getInitialTab(searchParams));
  const { data, isLoading, isError, refetch } = useQuery(guardianConnectionsQueryOptions);
  const connections = getConnectionData(data);
  const { activeConnections, pendingConnections } = splitConnections(connections);
  const sortedConnections = sortGuardianConnections(connections);

  const cancelMutation = useMutation({
    mutationKey: ['guardian-connection-cancel'],
    mutationFn: cancelGuardianConnectionRequest,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async () => {
      setFeedbackMessage('연결 요청을 취소했습니다.');
      await queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
    },
    onError: error => setFeedbackMessage(getErrorMessage(error, '연결 요청 취소에 실패했습니다.')),
  });

  const disconnectMutation = useMutation({
    mutationKey: ['guardian-connection-disconnect'],
    mutationFn: disconnectGuardianConnection,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async () => {
      setFeedbackMessage('연결을 해제했습니다.');
      await queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
    },
    onError: error => setFeedbackMessage(getErrorMessage(error, '연결 해제에 실패했습니다.')),
  });

  const isPending = cancelMutation.isPending || disconnectMutation.isPending;

  const handleDisconnect = (id: number) => {
    if (!window.confirm('이 피보호자와의 연결을 해제할까요?')) return;
    disconnectMutation.mutate(id);
  };

  const handleTabChange = (tab: GuardianWardsTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    tab === 'register' ? params.set('tab', 'register') : params.delete('tab');
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  };

  return (
    <section className={cx('page')}>
      <header className={cx('toolbar')}>
        <div>
          <strong className={cx('toolbarTitle')}>피보호자 관리</strong>
          <span className={cx('toolbarSub')}>연결됨 {activeConnections.length}명 · 대기 {pendingConnections.length}건</span>
        </div>
        <RefreshButton ariaLabel="새로고침" disabled={isLoading} onRefresh={() => refetch()} />
      </header>

      <div className={cx('tabs')} role="tablist">
        <button className={cx('tab', { active: activeTab === 'list' })} type="button" role="tab" aria-selected={activeTab === 'list'} onClick={() => handleTabChange('list')}>
          피보호자 목록
        </button>
        <button className={cx('tab', { active: activeTab === 'register' })} type="button" role="tab" aria-selected={activeTab === 'register'} onClick={() => handleTabChange('register')}>
          피보호자 등록
        </button>
      </div>

      {activeTab === 'list' ? (
        <div className={cx('content')}>
          {feedbackMessage && <p className={cx('feedback')}>{feedbackMessage}</p>}
          {isLoading && <EmptyState message="피보호자 목록을 불러오는 중입니다." />}
          {isError && <EmptyState message="피보호자 목록을 불러오지 못했습니다." />}
          {!isLoading && !isError && connections.length === 0 && (
            <div className={cx('emptyBox')}>
              <p className={cx('emptyText')}>아직 연결된 피보호자가 없습니다.</p>
              <button className={cx('primaryButton')} type="button" onClick={() => handleTabChange('register')}>
                피보호자 등록하기
              </button>
            </div>
          )}
          {sortedConnections.length > 0 && (
            <ul className={cx('list')}>
              {sortedConnections.map(connection => (
                <WardCard
                  key={connection.id}
                  connection={connection}
                  isPending={isPending}
                  onCancel={() => cancelMutation.mutate(connection.id)}
                  onDisconnect={() => handleDisconnect(connection.id)}
                />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <GuardianWardRegisterPanel embedded />
      )}
    </section>
  );
}

function WardCard({
  connection,
  isPending,
  onCancel,
  onDisconnect,
}: {
  connection: IConnectionItem;
  isPending: boolean;
  onCancel: () => void;
  onDisconnect: () => void;
}) {
  const isActive = connection.status === 'ACTIVE';
  const isPendingConn = connection.status === 'PENDING';
  const initial = (connection.partnerName || '?').charAt(0);
  const address = [connection.partnerAddress, connection.partnerAddressDetail].filter(Boolean).join(' ');
  const dateLabel = isActive ? '연결일' : '요청일';
  const dateValue = formatWardDate(isActive ? connection.connectedAt : connection.createdAt);

  return (
    <li className={cx('card')}>
      <div className={cx('cardBody')}>
        <div className={cx('avatar')}>{initial}</div>

        <div className={cx('info')}>
          <div className={cx('nameRow')}>
            <span className={cx('name')}>{connection.partnerName || '이름 확인 전'}</span>
            {connection.relation && <span className={cx('relation')}>{connection.relation}</span>}
            <span className={cx('badge', getConnectionStatusClass(connection.status))}>
              {getConnectionStatusLabel(connection.status)}
            </span>
            {(isActive || isPendingConn) && (
              <button
                className={cx('dangerButton')}
                type="button"
                disabled={isPending}
                onClick={isActive ? onDisconnect : onCancel}
              >
                {isActive ? '연결 해제' : '요청 취소'}
              </button>
            )}
          </div>

          <span className={cx('userId')}>{connection.partnerUserId}</span>

          <dl className={cx('details')}>
            {address && (
              <div className={cx('detailRow')}>
                <dt>📍</dt>
                <dd>{getActivePartnerValue(connection, address)}</dd>
              </div>
            )}
            <div className={cx('detailRow')}>
              <dt>📞</dt>
              <dd>{getPartnerPhoneValue(connection)}</dd>
            </div>
            <div className={cx('detailRow')}>
              <dt>✉</dt>
              <dd>{getActivePartnerValue(connection, connection.partnerEmail)}</dd>
            </div>
            <div className={cx('detailRow')}>
              <dt>👤</dt>
              <dd>
                {[
                  getActivePartnerValue(connection, formatPartnerGender(connection.partnerGender)),
                  getActivePartnerValue(connection, connection.partnerBirthDate),
                ].filter(v => v && v !== '연결 후 공개').join(' · ') || '연결 후 공개'}
              </dd>
            </div>
            <div className={cx('detailRow')}>
              <dt>{dateLabel}</dt>
              <dd>{dateValue}</dd>
            </div>
          </dl>
        </div>
      </div>

    </li>
  );
}

function getInitialTab(searchParams: ReturnType<typeof useSearchParams>): GuardianWardsTab {
  return searchParams.get('tab') === 'register' ? 'register' : 'list';
}

function sortGuardianConnections(connections: IConnectionItem[]) {
  const order: Record<IConnectionItem['status'], number> = { ACTIVE: 0, PENDING: 1, REFUSED: 2, CANCELLED: 3, DISCONNECTED: 4 };
  return [...connections].sort((a, b) => order[a.status] - order[b.status]);
}

function formatWardDate(value: string | null) {
  if (!value) return '확인 전';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '확인 전';
  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}
