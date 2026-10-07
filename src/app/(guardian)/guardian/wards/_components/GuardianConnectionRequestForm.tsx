'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { requestWardConnection } from '@/service/api/guardian/connection';
import { guardianConnectionRequestsQueryKey, guardianConnectionsQueryKey } from '@/service/query/guardian';
import { getErrorMessage } from '@/components/connections/ConnectionShared';
import styles from './GuardianConnectionRequestForm.module.css';

const cx = classNames.bind(styles);

const RELATION_OPTIONS = ['아들', '딸', '배우자', '부모', '형제자매', '손자녀', '직접입력'] as const;
const CUSTOM_RELATION_OPTION = '직접입력';
type RelationOption = (typeof RELATION_OPTIONS)[number] | '';

export function GuardianConnectionRequestForm() {
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState('');
  const [relation, setRelation] = useState<RelationOption>('');
  const [customRelation, setCustomRelation] = useState('');
  const [message, setMessage] = useState('');

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey }),
        queryClient.invalidateQueries({ queryKey: guardianConnectionRequestsQueryKey }),
      ]);
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
    <form className={cx('card')} onSubmit={handleSubmit}>
      <div className={cx('formGrid')}>
        <label className={cx('field')}>
          피보호자 회원 ID
          <input
            value={targetId}
            onChange={event => setTargetId(event.target.value)}
            placeholder="예) abc123"
            maxLength={20}
            autoComplete="off"
          />
        </label>

        <label className={cx('field')}>
          피보호자와의 관계
          <select value={relation} onChange={event => setRelation(event.target.value as RelationOption)}>
            <option value="" disabled>
              관계 선택
            </option>
            {RELATION_OPTIONS.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {relation === CUSTOM_RELATION_OPTION && (
          <label className={cx('field', 'fieldWide')}>
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
      </div>

      <footer className={cx('footer')}>
        <p className={cx('hint')}>
          피보호자가 본인의 마이페이지에서 확인 가능한 회원 ID를 입력하고, 피보호자와의 관계를 선택해 주세요.
        </p>
        <button
          className={cx('submitButton')}
          type="submit"
          disabled={!targetId.trim() || !requestRelation || isPending}
        >
          {isPending ? '요청 중...' : '승인 요청'}
        </button>
      </footer>

      {message && <p className={cx('message')}>{message}</p>}
    </form>
  );
}
