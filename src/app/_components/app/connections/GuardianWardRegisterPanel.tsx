'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { requestWardConnection } from '@/service/api/connection';
import { guardianConnectionsQueryKey } from '@/service/query/connection';
import { cx, getErrorMessage } from './ConnectionShared';

export function GuardianWardRegisterPanel() {
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState('');
  const [message, setMessage] = useState('');

  const { mutate, isPending } = useMutation({
    mutationKey: ['guardian-connection-request'],
    mutationFn: requestWardConnection,
    onMutate: () => setMessage(''),
    onSuccess: async () => {
      setTargetId('');
      setMessage('피보호자에게 연결 요청을 보냈습니다.');
      await queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
    },
    onError: error => setMessage(getErrorMessage(error, '연결 요청에 실패했습니다.')),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTargetId = targetId.trim();
    if (!trimmedTargetId || isPending) return;
    mutate({ targetId: trimmedTargetId });
  };

  return (
    <section className={cx('connectionPage')}>
      <div className={cx('connectionHeader')}>
        <span className={cx('eyebrow')}>피보호자 연결</span>
        <h2>피보호자 ID로 연결 요청을 보내세요.</h2>
        <p>피보호자가 요청을 수락하면 보호자 대시보드에서 상태를 확인할 수 있습니다.</p>
      </div>

      <div className={cx('connectionRegisterGrid')}>
        <form className={cx('connectionFormCard')} onSubmit={handleSubmit}>
          <label className={cx('connectionField')}>
            <span>피보호자 ID</span>
            <input
              value={targetId}
              onChange={event => setTargetId(event.target.value)}
              placeholder="피보호자 ID를 입력하세요"
              maxLength={20}
              autoComplete="off"
            />
          </label>
          <button className={cx('connectionSubmitButton')} type="submit" disabled={!targetId.trim() || isPending}>
            {isPending ? '요청 중...' : '연결 요청'}
          </button>
        </form>

        <div className={cx('connectionGuideCard')}>
          <span className={cx('connectionStatus')}>안내</span>
          <strong>요청 후 피보호자 수락이 필요합니다.</strong>
          <p>요청이 전송되면 피보호자에게 알림이 전달되고, 수락 전까지 목록에서 수락 대기 상태로 표시됩니다.</p>
        </div>
      </div>

      {message && <p className={cx('connectionMessage')}>{message}</p>}

      <Link className={cx('connectionTextLink')} href="/guardian/wards">
        피보호자 목록에서 요청 상태 확인하기
      </Link>
    </section>
  );
}
