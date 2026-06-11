'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { Tabs } from '@/components/Tabs';
import { cancelGuardianConnectionRequest, disconnectGuardianConnection } from '@/service/api/connect/guardian';
import { IConnectionItem } from '@/service/interface/connection';
import { guardianConnectionsQueryKey, guardianConnectionsQueryOptions } from '@/service/query/connection';
import { ConnectionCard } from './ConnectionCard';
import { EmptyState, getConnectionData, getErrorMessage } from './ConnectionShared';
import { GuardianWardRegisterPanel } from './GuardianWardRegisterPanel';
import listStyles from './ConnectionList.module.css';
import styles from './GuardianWardsPanel.module.css';

const cx = classNames.bind(styles);
const listCx = classNames.bind(listStyles);

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

      <Tabs
        ariaLabel="피보호자 관리 탭"
        items={[
          { value: 'list', label: '피보호자 목록' },
          { value: 'register', label: '피보호자 등록' },
        ]}
        onChange={handleTabChange}
        size="sm"
        value={activeTab}
      />

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
            <ul className={listCx('connectionList')}>
              {sortedConnections.map(connection => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  isPending={isPending}
                  role="guardian"
                  primaryAction={
                    connection.status === 'ACTIVE'
                      ? () => handleDisconnect(connection.id)
                      : connection.status === 'PENDING'
                        ? () => cancelMutation.mutate(connection.id)
                        : undefined
                  }
                  primaryLabel={connection.status === 'ACTIVE' ? '연결 해제' : connection.status === 'PENDING' ? '요청 취소' : undefined}
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

function getInitialTab(searchParams: ReturnType<typeof useSearchParams>): GuardianWardsTab {
  return searchParams.get('tab') === 'register' ? 'register' : 'list';
}

function sortGuardianConnections(connections: IConnectionItem[]) {
  const order: Record<IConnectionItem['status'], number> = { ACTIVE: 0, PENDING: 1, REFUSED: 2, CANCELLED: 3, DISCONNECTED: 4 };
  return [...connections].sort((a, b) => order[a.status] - order[b.status]);
}

function splitConnections(connections: IConnectionItem[]) {
  return {
    activeConnections: connections.filter(connection => connection.status === 'ACTIVE'),
    pendingConnections: connections.filter(connection => connection.status === 'PENDING'),
  };
}
