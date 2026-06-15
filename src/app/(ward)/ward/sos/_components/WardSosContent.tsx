'use client';

import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { Icon } from '@/components/Icon';
import { getWardActiveConnections } from '@/service/api/connect/ward';
import { useWardSosMutation } from '@/service/query/ward';
import { getConnectionData } from '@/components/connections/ConnectionShared';
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
  const isMint = index % 2 === 0;

  return (
    <article className={cx('guardianCard', isMint ? 'guardianCardMint' : 'guardianCardSky')}>
      <div className={cx('guardianHead')}>
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
  const [guardians, setGuardians] = useState<IConnectionItem[]>([]);
  const [isLoadingGuardians, setIsLoadingGuardians] = useState(true);
  const [isGuardiansError, setIsGuardiansError] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [successState, setSuccessState] = useState<{ sosEventId: number; triggeredAt: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const { mutate: triggerSos, isPending } = useWardSosMutation();
  const currentGuardians = guardians
    .slice()
    .sort((a, b) => new Date(b.connectedAt ?? b.createdAt).getTime() - new Date(a.connectedAt ?? a.createdAt).getTime());

  useEffect(() => {
    let alive = true;

    async function loadGuardians() {
      setIsLoadingGuardians(true);
      setIsGuardiansError(false);

      try {
        const response = await getWardActiveConnections();
        if (!alive) return;
        setGuardians(getConnectionData(response));
      } catch {
        if (!alive) return;
        setGuardians([]);
        setIsGuardiansError(true);
      } finally {
        if (!alive) return;
        setIsLoadingGuardians(false);
      }
    }

    void loadGuardians();

    return () => {
      alive = false;
    };
  }, []);

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

        {isGuardiansError ? (
          <div className={cx('emptyState')}>
            <div className={cx('emptyIcon')}>
              <Icon name="users" size={20} decorative />
            </div>
            <div className={cx('emptyCopy')}>
              <strong>보호자 목록을 불러오지 못했습니다.</strong>
              <span>잠시 후 다시 시도해주세요.</span>
            </div>
          </div>
        ) : isLoadingGuardians ? (
          <div className={cx('emptyState')}>
            <div className={cx('emptyIcon')}>
              <Icon name="users" size={20} decorative />
            </div>
            <div className={cx('emptyCopy')}>
              <strong>보호자 리스트를 불러오는 중입니다.</strong>
              <span>연결된 보호자가 있으면 곧 표시됩니다.</span>
            </div>
          </div>
        ) : currentGuardians.length > 0 ? (
          <div className={cx('guardianGrid')}>
            {currentGuardians.map((connection, index) => (
              <GuardianCard key={connection.id} connection={connection} index={index} />
            ))}
          </div>
        ) : (
          <div className={cx('emptyState')}>
            <div className={cx('emptyIcon')}>
              <Icon name="users" size={20} decorative />
            </div>
            <div className={cx('emptyCopy')}>
              <strong>현재 연결된 보호자가 없습니다.</strong>
              <span>보호자를 연결하면 이곳에 바로 전화할 수 있는 카드가 표시됩니다.</span>
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
