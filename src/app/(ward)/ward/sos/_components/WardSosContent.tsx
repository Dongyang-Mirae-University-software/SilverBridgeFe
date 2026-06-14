'use client';

import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function makeTelHref(phone?: string | null) {
  const digits = phone?.replace(/\D/g, '');
  return digits ? `tel:${digits}` : null;
}

function GuardianCard({ connection }: { connection: IConnectionItem }) {
  const formattedPhone = formatTel(connection.partnerPhone);
  const telHref = makeTelHref(connection.partnerPhone);

  return (
    <article className={cx('guardianCard')}>
      <div className={cx('guardianMeta')}>
        <div className={cx('guardianAvatar')}>
          <Icon name="phone" size={20} decorative />
        </div>
        <div className={cx('guardianInfo')}>
          <strong>{connection.partnerName}</strong>
          <span>{connection.relation || '보호자'}</span>
        </div>
      </div>

      <div className={cx('guardianActions')}>
        <div className={cx('guardianPhone')}>
          <span>전화번호</span>
          <strong>{formattedPhone || '-'}</strong>
        </div>
        {telHref ? (
          <a className={cx('callButton')} href={telHref}>
            <Icon name="phone" size={16} decorative />
            전화
          </a>
        ) : (
          <span className={cx('callButtonDisabled')}>전화 없음</span>
        )}
      </div>
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
      <section className={cx('hero')}>
        <div>
          <span className={cx('eyebrow')}>피보호자 SOS</span>
          <h2>위급할 때 바로 도움을 요청하세요</h2>
          <p>SOS는 이력을 저장하고 연결된 보호자에게 실시간 알림을 보냅니다. 201 응답이면 전송 완료로 처리합니다.</p>
        </div>
        <div className={cx('heroBadge')}>
          <span>201 Created</span>
          <strong>이력 저장 성공</strong>
        </div>
      </section>

      <section className={cx('content')}>
        <div className={cx('mainCard')}>
          <div className={cx('mainCardHeader')}>
            <div>
              <h3>긴급 SOS</h3>
              <p>버튼을 누르면 보호자에게 즉시 알림이 전송됩니다.</p>
            </div>
            <div className={cx('cooldown')}>30초 쿨다운</div>
          </div>

          <button className={cx('sosButton')} type="button" onClick={() => setIsConfirmOpen(true)}>
            <span className={cx('sosIcon')}>
              <Icon name="alert" size={34} decorative />
            </span>
            <span className={cx('sosText')}>
              <strong>긴급 SOS 보내기</strong>
              <span>피보호자 이력을 저장하고 알림을 발송합니다</span>
            </span>
          </button>

          <div className={cx('noteBox')}>
            <strong>안내</strong>
            <span>연결된 보호자가 없어도 이력은 저장됩니다. 알림은 비동기로 처리됩니다.</span>
          </div>
        </div>

        <aside className={cx('sideCard')}>
          <div className={cx('sideHeader')}>
            <div>
              <h3>연결된 보호자</h3>
              <p>전화 버튼으로 바로 연락할 수 있습니다.</p>
            </div>
            <span className={cx('countBadge')}>{activeGuardians.length}명</span>
          </div>

          {activeGuardians.length > 0 ? (
            <div className={cx('guardianList')}>
              {activeGuardians.map(connection => (
                <GuardianCard key={connection.id} connection={connection} />
              ))}
            </div>
          ) : (
            <div className={cx('emptyState')}>
              <Icon name="users" size={20} decorative />
              <span>활성화된 보호자 연결이 없습니다.</span>
            </div>
          )}
        </aside>
      </section>

      {isConfirmOpen && (
        <CommonModal
          type="warning"
          tone="guardian"
          title="SOS 전송"
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
