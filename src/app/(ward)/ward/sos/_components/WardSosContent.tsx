'use client';

import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { useState } from 'react';
import Link from 'next/link';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { Icon } from '@/components/Icon';
import { UserAvatar } from '@/components/UserAvatar';
import { useDashboard } from '@/components/layout/dashboard/DashboardContext';
import { useWardSosMutation } from '@/service/query/ward';
import useWardActiveGuardians from '@/hooks/useWardActiveGuardians';
import type { IConnectionItem } from '@/service/interface/connection';
import styles from './WardSosContent.module.css';

dayjs.locale('ko');

const cx = classNames.bind(styles);

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

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

function Emergency119Dialpad({ onClose }: { onClose: () => void }) {
  const [digits, setDigits] = useState('119');

  return (
    <div className={cx('dialOverlay')} role="dialog" aria-modal="true" aria-label="119 신고 키패드">
      <div className={cx('dialCard')}>
        <div className={cx('dialHeader')}>
          <span className={cx('dialNotice')}>학생 프로젝트 화면입니다 · 실제로 신고 전화가 발신되지 않습니다</span>
          <button className={cx('dialClose')} type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className={cx('dialDisplay')}>{digits || ' '}</div>

        <div className={cx('dialPad')}>
          {DIAL_KEYS.map(key => (
            <button
              key={key}
              type="button"
              className={cx('dialKey')}
              onClick={() => setDigits(prev => (prev + key).slice(0, 15))}
            >
              {key}
            </button>
          ))}
        </div>

        <div className={cx('dialActions')}>
          <button
            className={cx('dialBackspace')}
            type="button"
            onClick={() => setDigits(prev => prev.slice(0, -1))}
            aria-label="한 글자 지우기"
          >
            ⌫
          </button>
          <button className={cx('dialCallButton')} type="button" disabled aria-label="발신 불가(테스트 화면)">
            <Icon name="phone" size={26} decorative />
          </button>
        </div>
      </div>
    </div>
  );
}

function GuardianCard({
  connection,
  index,
  onCall,
}: {
  connection: IConnectionItem;
  index: number;
  onCall: () => void;
}) {
  const telHref = makeTelHref(connection.partnerPhone);
  const isMint = index % 2 === 0;

  return (
    <article className={cx('guardianCard', isMint ? 'guardianCardMint' : 'guardianCardSky')}>
      <div className={cx('guardianHead')}>
        {telHref ? (
          <span className={cx('guardianPhoneIcon')} aria-hidden="true">
            <Icon name="phone" size={30} decorative />
          </span>
        ) : null}
      </div>

      <div className={cx('guardianBody')}>
        <UserAvatar imageUrl={connection.partnerProfileImage} size="w-120" />
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
        <a
          className={cx('cardLink')}
          href={telHref}
          aria-label={`${connection.partnerName}에게 전화하기`}
          onClick={onCall}
        />
      ) : null}
    </article>
  );
}

export default function WardSosContent() {
  const { wardSettings } = useDashboard();
  const { activeGuardians, isLoading: isLoadingGuardians, isError: isGuardiansError } = useWardActiveGuardians();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDialOpen, setIsDialOpen] = useState(false);
  const [successState, setSuccessState] = useState<{ sosEventId: number; triggeredAt: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const { mutate: triggerSos, isPending } = useWardSosMutation();
  const currentGuardians = activeGuardians
    .slice()
    .sort(
      (a, b) => new Date(b.connectedAt ?? b.createdAt).getTime() - new Date(a.connectedAt ?? a.createdAt).getTime(),
    );

  function handleHeroPress() {
    if (wardSettings.sosAction === 'call119') {
      setIsDialOpen(true);
      return;
    }

    setIsConfirmOpen(true);
  }

  function reportSosError(error: unknown) {
    const message = (error as { message?: string })?.message || 'SOS 전송에 실패했습니다.';
    setErrorMessage(message);
  }

  function handleConfirm() {
    setIsConfirmOpen(false);
    setErrorMessage('');

    triggerSos(undefined, {
      onSuccess: data => {
        if (wardSettings.sosAction === 'call119AndNotify') {
          setIsDialOpen(true);
        }

        setSuccessState({
          sosEventId: data?.sosEventId ?? Date.now(),
          triggeredAt: data?.triggeredAt ?? new Date().toISOString(),
        });
      },
      onError: reportSosError,
    });
  }

  function handleCloseSuccess() {
    setSuccessState(null);
  }

  function handleGuardianCall() {
    triggerSos({ triggerType: 'GUARDIAN_CALL' });
  }

  return (
    <div className={cx('page')}>
      <button className={cx('hero')} type="button" onClick={handleHeroPress}>
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
              <GuardianCard key={connection.id} connection={connection} index={index} onCall={handleGuardianCall} />
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
          message={
            wardSettings.sosAction === 'notifyGuardianFirst'
              ? `보호자에게 알림을 보냈습니다.\n필요하면 아래 버튼으로 119 화면을 여세요.\n${formatTriggeredAt(successState.triggeredAt)}`
              : `SOS 이력이 저장되었습니다.\n이력 ID ${successState.sosEventId} · ${formatTriggeredAt(successState.triggeredAt)}`
          }
          confirmText={wardSettings.sosAction === 'notifyGuardianFirst' ? '119 화면 열기' : '확인'}
          secondaryText={wardSettings.sosAction === 'notifyGuardianFirst' ? '닫기' : undefined}
          onConfirm={
            wardSettings.sosAction === 'notifyGuardianFirst'
              ? () => {
                  setIsDialOpen(true);
                  handleCloseSuccess();
                }
              : handleCloseSuccess
          }
          onSecondary={handleCloseSuccess}
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

      {isDialOpen && <Emergency119Dialpad onClose={() => setIsDialOpen(false)} />}
    </div>
  );
}
