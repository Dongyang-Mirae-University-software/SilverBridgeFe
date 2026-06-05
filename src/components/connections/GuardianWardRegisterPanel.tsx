'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { requestWardConnection } from '@/service/api/connect/guardian';
import { guardianConnectionsQueryKey, guardianConnectionsQueryOptions } from '@/service/query/connection';
import { cx, getConnectionData, getErrorMessage } from './ConnectionShared';

const RELATION_OPTIONS = ['아들', '딸', '배우자', '부모', '형제자매', '손자녀', '직접입력'] as const;
const CUSTOM_RELATION_OPTION = '직접입력';
type RelationOption = (typeof RELATION_OPTIONS)[number] | '';

export function GuardianWardRegisterPanel({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState('');
  const [relation, setRelation] = useState<RelationOption>('');
  const [customRelation, setCustomRelation] = useState('');
  const [message, setMessage] = useState('');
  const { data: connectionsResponse, isLoading } = useQuery(guardianConnectionsQueryOptions);
  const pendingConnections = getConnectionData(connectionsResponse).filter(
    connection => connection.status === 'PENDING',
  );
  const requestRelation = relation === CUSTOM_RELATION_OPTION ? customRelation.trim() : relation;

  const { mutate, isPending } = useMutation({
    mutationKey: ['guardian-connection-request'],
    mutationFn: requestWardConnection,
    onMutate: () => setMessage(''),
    onSuccess: async () => {
      setTargetId('');
      setRelation('');
      setCustomRelation('');
      setMessage('피보호자에게 연결 요청을 보냈습니다.');
      await queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
    },
    onError: error => setMessage(getErrorMessage(error, '연결 요청에 실패했습니다.')),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTargetId = targetId.trim();
    if (!trimmedTargetId || !requestRelation || isPending) return;
    mutate({ relation: requestRelation, targetId: trimmedTargetId });
  };

  return (
    <section className={cx(embedded ? 'connectionTabContent' : 'connectionPage', 'connectionRegisterPage')}>
      <form className={cx('connectionRegisterCard')} onSubmit={handleSubmit}>
        <div className={cx('connectionRegisterHeader')}>
          <div>
            <span>새 연결 요청</span>
            <strong>피보호자 등록</strong>
          </div>
          <small>회원 ID와 관계만 입력하면 요청이 전송됩니다.</small>
        </div>
        <div className={cx('connectionRegisterFormRow')}>
          <label className={cx('connectionField')}>
            회원 ID
            <input
              value={targetId}
              onChange={event => setTargetId(event.target.value)}
              placeholder="예) WD-2026-0188"
              maxLength={20}
              autoComplete="off"
            />
          </label>
        </div>
        <div className={cx('connectionRegisterFormRow')}>
          <label className={cx('connectionField')}>
            관계
            <select
              value={relation}
              onChange={event => setRelation(event.target.value as RelationOption)}
            >
              <option value="" disabled>
                피보호자와의 관계를 선택하세요.
              </option>
              {RELATION_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {relation === CUSTOM_RELATION_OPTION && (
            <label className={cx('connectionField')}>
              직접입력
              <input
                value={customRelation}
                onChange={event => setCustomRelation(event.target.value)}
                placeholder="예) 며느리"
                maxLength={10}
                autoComplete="off"
              />
            </label>
          )}
          <button
            className={cx('connectionSubmitButton')}
            type="submit"
            disabled={!targetId.trim() || !requestRelation || isPending}
          >
            {isPending ? '요청 중...' : '승인 요청'}
          </button>
        </div>
        <p className={cx('connectionRegisterHint')}>
          피보호자가 본인의 마이페이지에서 확인 가능한 회원 ID와 관계를 입력해 주세요. 요청이 전달되면 피보호자가
          응답합니다.
        </p>
        {message && <p className={cx('connectionMessage')}>{message}</p>}
      </form>
      <div className={cx('connectionHistoryCard')}>
        <div className={cx('connectionHistoryHeader')}>
          <strong>요청 내역</strong>
          <span>{pendingConnections.length}건</span>
        </div>

        {isLoading ? (
          <p className={cx('connectionEmpty')}>요청 내역을 불러오는 중입니다.</p>
        ) : pendingConnections.length > 0 ? (
          <ul className={cx('connectionHistoryList')}>
            {pendingConnections.map(connection => (
              <li key={connection.id} className={cx('connectionHistoryItem')}>
                <div>
                  <strong>{connection.partnerName || '확인 전'}</strong>
                  <span>{connection.partnerUserId}</span>
                </div>
                <div>
                  <small>{formatRegisterDate(connection.createdAt)}</small>
                  <span className={cx('connectionStatus')}>요청중</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cx('connectionEmpty')}>수락 대기 중인 요청이 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function formatRegisterDate(value: string | null) {
  if (!value) return '확인 전';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '확인 전';

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}
