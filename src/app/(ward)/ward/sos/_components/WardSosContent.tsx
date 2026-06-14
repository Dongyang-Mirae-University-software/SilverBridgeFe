'use client';

import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { Icon } from '@/components/Icon';
import { wardActiveConnectionsQueryOptions, useWardSosMutation } from '@/service/query/ward';
import type { IConnectionItem } from '@/service/interface/connection';
import styles from './WardSosContent.module.css';

dayjs.locale('ko');

const cx = classNames.bind(styles);

function formatTriggeredAt(value?: string) {
  if (!value) return '-';
  return dayjs(value).format('YYYY.MM.DD A h:mm');
}

function formatTel(phone?: string | null) {
  if (!phone) return '-';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits || '-';
}

function makeTelHref(phone?: string | null) {
  const digits = phone?.replace(/\D/g, '');
  return digits ? `tel:${digits}` : null;
}

function getInitial(name?: string | null) {
  const value = name?.trim();
  return value ? value.charAt(0) : '보';
}

function GuardianCard({ connection, index }: { connection: IConnectionItem; index: number }) {
  const telHref = makeTelHref(connection.partnerPhone);
  const badgeLabel = `${index + 1}순위 보호자`;
  const isMint = index % 2 === 0;

  return (
    <article className={cx('guardianCard', isMint ? 'guardianCardMint' : 'guardianCardSky')}>
      <div className={cx('guardianHead')}>
        <span className={cx('guardianBadge')}>{badgeLabel}</span>
        {telHref ? (
          <span className={cx('guardianPhoneIcon')} aria-hidden="true">
            <Icon name="phone" size={18} decorative />
          </span>
        ) : null}
      </div>

      <div className={cx('guardianBody')}>
        <div className={cx('guardianAvatar')}>{getInitial(connection.partnerName)}</div>
        <div className={cx('guardianInfo')}>
          <strong>{connection.partnerName}</strong>
          <span>{connection.relation || '보호자'}</span>
        </div>
      </div>

      <div className={cx('guardianFooter')}>
        <div className={cx('guardianPhone')}>
          <span>전화번호</span>
          <strong>{formatTel(connection.partnerPhone)}</strong>
        </div>
      </div>

      {telHref ? (
        <a className={cx('cardLink')} href={telHref} aria-label={`${connection.partnerName}에게 전화하기`} />
      ) : null}
    </article>
  );
}

export default function WardSosContent() {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [successState, setSuccessState] = useState<{ sosEventId: number; triggeredAt: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const { data: guardians = [] } = useQuery(wardActiveConnectionsQueryOptions);
  const { mutate: triggerSos, isPending } = useWardSosMutation();

  const activeGuardians = useMemo(() => guardians.filter(connection => connection.status === 'ACTIVE'), [guardians]);

  function handleConfirm() {
    setIsConfirmOpen(false);
    setErrorMessage('');

    triggerSos(undefined, {
      onSuccess: response => {
        const data = response.data;
        if (data?.sosEventId && data.triggeredAt) {
          setSuccessState(data);
          return;
        }

        setSuccessState({
          sosEventId: Number(data?.sosEventId ?? Date.now()),
          triggeredAt: data?.triggeredAt ?? new Date().toISOString(),
        });
      },
      onError: error => {
        const message = (error as { message?: string }).message || 'SOS 전송에 실패했습니다.';
        setErrorMessage(message);
      },
    });
  }

  function handleCloseSuccess() {
    setSuccessState(null);
  }

  return (
    <div className={cx('page')}>
      <button className={cx('hero')} type="button" onClick={() => setIsConfirmOpen(true)}>
        <div className={cx('heroIcon')}>
          <Icon name="alert" size={40} decorative />
        </div>
        <span className={cx('heroEyebrow')}>SOS</span>
        <h2>긴급 SOS</h2>
        <p>탭하여 즉시 도움 요청</p>
      </button>

      <section className={cx('phoneSection')}>
        <div className={cx('sectionHeader')}>
          <h3>보호자에게 직접 전화하기</h3>
        </div>

        {activeGuardians.length > 0 ? (
          <div className={cx('guardianGrid')}>
            {activeGuardians.map((connection, index) => (
              <GuardianCard key={connection.id} connection={connection} index={index} />
            ))}
          </div>
        ) : (
          <div className={cx('emptyState')}>
            <div className={cx('emptyIcon')}>
              <Icon name="users" size={20} decorative />
            </div>
            <div className={cx('emptyCopy')}>
              <strong>활성화된 보호자 연결이 없습니다.</strong>
              <span>보호자를 연결하면 이곳에 직통 전화 카드가 표시됩니다.</span>
            </div>
            <Link className={cx('emptyButton')} href="/ward/guardians">
              보호자 연결하기
            </Link>
          </div>
        )}
      </section>

      {isConfirmOpen && (
        <CommonModal
          type="warning"
          tone="guardian"
          title="긴급 SOS 전송"
          message="긴급 SOS를 보내면 연결된 보호자에게 알림이 전달됩니다."
          confirmText={isPending ? '전송 중...' : '보내기'}
          secondaryText="취소"
          onConfirm={handleConfirm}
          onSecondary={() => setIsConfirmOpen(false)}
          onClose={() => setIsConfirmOpen(false)}
        />
      )}

      {successState && (
        <CommonModal
          type="success"
          tone="guardian"
          title="SOS 전송 완료"
          message={`SOS 이력이 저장되었습니다.\n이력 ID ${successState.sosEventId} · ${formatTriggeredAt(successState.triggeredAt)}`}
          confirmText="확인"
          onConfirm={handleCloseSuccess}
          onClose={handleCloseSuccess}
        />
      )}

      {!!errorMessage && (
        <CommonModal
          type="error"
          tone="guardian"
          title="SOS 전송 실패"
          message={errorMessage}
          confirmText="확인"
          onConfirm={() => setErrorMessage('')}
          onClose={() => setErrorMessage('')}
        />
      )}
    </div>
  );
}
