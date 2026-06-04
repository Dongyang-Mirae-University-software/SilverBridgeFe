'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { RefreshButton } from '@/components/RefreshButton';
import { UserAvatar } from '@/components/UserAvatar';
import { cancelGuardianConnectionRequest, disconnectGuardianConnection } from '@/service/api/connect/guardian';
import { IConnectionItem } from '@/service/interface/connection';
import { guardianConnectionsQueryKey, guardianConnectionsQueryOptions } from '@/service/query/connection';
import {
  cx,
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

type GuardianWardsTab = 'list' | 'register';

export function GuardianWardsPanel() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [activeTab, setActiveTab] = useState<GuardianWardsTab>(() => getInitialTab(searchParams));
  const { data, isLoading, isError, refetch } = useQuery(guardianConnectionsQueryOptions);
  const connections = getConnectionData(data);
  const { activeConnections, pendingConnections } = splitConnections(connections);

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
  const sortedConnections = sortGuardianConnections(connections);

  const handleDisconnect = (connectionId: number) => {
    if (!window.confirm('이 피보호자와의 연결을 해제할까요?')) return;
    disconnectMutation.mutate(connectionId);
  };
  const handleTabChange = (tab: GuardianWardsTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);

    const params = new URLSearchParams(window.location.search);
    if (tab === 'register') {
      params.set('tab', 'register');
    } else {
      params.delete('tab');
    }

    const queryString = params.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  };

  return (
    <section className={cx('connectionPage', 'wardListPage')}>
      <div className={cx('wardListToolbar')}>
        <div>
          <strong>현재 돌보고 있는 피보호자 {activeConnections.length}명</strong>
          <span>수락 대기 {pendingConnections.length}건</span>
        </div>
        <div className={cx('wardListToolbarActions')}>
          <RefreshButton ariaLabel="피보호자 목록 새로고침" disabled={isLoading} onRefresh={() => refetch()} />
        </div>
      </div>

      <div className={cx('connectionTabs')} role="tablist" aria-label="피보호자 관리 탭">
        <button
          className={cx('connectionTabButton', { active: activeTab === 'list' })}
          type="button"
          role="tab"
          aria-selected={activeTab === 'list'}
          onClick={() => handleTabChange('list')}
        >
          피보호자 리스트
        </button>
        <button
          className={cx('connectionTabButton', { active: activeTab === 'register' })}
          type="button"
          role="tab"
          aria-selected={activeTab === 'register'}
          onClick={() => handleTabChange('register')}
        >
          피보호자 등록
        </button>
      </div>

      {activeTab === 'list' ? (
        <div className={cx('connectionTabContent')}>
          {feedbackMessage && <p className={cx('connectionMessage')}>{feedbackMessage}</p>}
          {isLoading && <EmptyState message="피보호자 목록을 불러오는 중입니다." />}
          {isError && <EmptyState message="피보호자 목록을 불러오지 못했습니다." />}
          {!isLoading && !isError && connections.length === 0 && (
            <div className={cx('connectionEmptyBox')}>
              <EmptyState message="아직 연결된 피보호자가 없습니다." />
              <button className={cx('connectionLinkButton')} type="button" onClick={() => handleTabChange('register')}>
                피보호자 연결 요청하기
              </button>
            </div>
          )}

          {connections.length > 0 && (
            <ul className={cx('wardListCards')}>
              {sortedConnections.map(connection => (
                <WardListCard
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

function getInitialTab(searchParams: ReturnType<typeof useSearchParams>): GuardianWardsTab {
  return searchParams.get('tab') === 'register' ? 'register' : 'list';
}

function WardListCard({
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
  const isPendingConnection = connection.status === 'PENDING';
  const actionLabel = isActive ? '연결 해제' : isPendingConnection ? '요청 취소' : '';
  const actionHandler = isActive ? onDisconnect : isPendingConnection ? onCancel : null;
  const address = [connection.partnerAddress, connection.partnerAddressDetail].filter(Boolean).join(' ');
  const dateText = isActive ? `연결일 ${formatWardListDate(connection.connectedAt)}` : `요청일 ${formatWardListDate(connection.createdAt)}`;

  return (
    <li className={cx('wardListCard')}>
      <div className={cx('wardListCardHeader')}>
        <UserAvatar size="w-60" imageUrl={connection.partnerProfileImage} />
        <div className={cx('wardListProfile')}>
          <div className={cx('wardListNameRow')}>
            <strong>{connection.partnerName || '이름 확인 전'}</strong>
            <span className={cx('connectionStatus', getConnectionStatusClass(connection.status))}>
              {getConnectionStatusLabel(connection.status)}
            </span>
          </div>
          <span>{connection.partnerUserId}</span>
          <small>{dateText}</small>
        </div>
      </div>

      <div className={cx('wardListQuickInfo')}>
        <InfoRow label="연락처" value={getPartnerPhoneValue(connection)} />
        <InfoRow label="이메일" value={getActivePartnerValue(connection, connection.partnerEmail)} />
        <InfoRow label="관계" value={connection.relation || '정보 없음'} />
      </div>

      <div className={cx('wardListInfoGrid')}>
        <InfoRow label="성별" value={getActivePartnerValue(connection, formatPartnerGender(connection.partnerGender))} />
        <InfoRow label="생년월일" value={getActivePartnerValue(connection, connection.partnerBirthDate)} />
        <InfoRow label="우편번호" value={getActivePartnerValue(connection, connection.partnerPostcode)} />
        <InfoRow label="주소" value={getActivePartnerValue(connection, address)} />
        <InfoRow label="요청자" value={connection.requester ? '보호자' : '피보호자'} />
      </div>

      {actionHandler && (
        <div className={cx('wardListCardFooter')}>
          <button className={cx('wardListDangerButton')} type="button" disabled={isPending} onClick={actionHandler}>
            {actionLabel}
          </button>
        </div>
      )}
    </li>
  );
}

function sortGuardianConnections(connections: IConnectionItem[]) {
  const statusOrder: Record<IConnectionItem['status'], number> = {
    ACTIVE: 0,
    PENDING: 1,
    REFUSED: 2,
    CANCELLED: 3,
    DISCONNECTED: 4,
  };

  return [...connections].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={cx('wardListInfoRow')}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatWardListDate(value: string | null) {
  if (!value) return '확인 전';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '확인 전';

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
