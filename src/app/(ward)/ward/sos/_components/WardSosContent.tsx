'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { formatDateTime } from '@/utils/format/date';
import { Icon } from '@/components/Icon';
import { useDashboard } from '@/components/layout/dashboard/DashboardContext';
import useModalStore from '@/store/modalStore';
import { useWardSosMutation } from '@/service/query/ward';
import { useWardActiveGuardians } from '@/hooks/useActiveConnections';
import type { WardSosResponse } from '@/service/interface/ward/sos';
import { WardGuardianCallSection } from './WardGuardianCallSection';
import styles from './WardSosContent.module.css';

const cx = classNames.bind(styles);

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

function Emergency119Dialpad({ guardianNotified, onClose }: { guardianNotified?: boolean; onClose: () => void }) {
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

        {guardianNotified && <p className={cx('dialGuardianNotice')}>보호자에게도 알렸습니다.</p>}

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

export default function WardSosContent() {
  const { wardSettings } = useDashboard();
  const { openModal, onCloseModal } = useModalStore(state => ({
    openModal: state.openModal,
    onCloseModal: state.onCloseModal,
  }));
  const { activeGuardians, hasActiveGuardians, isLoading: isLoadingGuardians, isError: isGuardiansError } =
    useWardActiveGuardians();
  const { mutate: triggerSos, mutateAsync: triggerSosAsync } = useWardSosMutation();
  const [isSending, setIsSending] = useState(false);

  function openDialModal(guardianNotified?: boolean) {
    openModal(<Emergency119Dialpad guardianNotified={guardianNotified} onClose={onCloseModal} />);
  }

  function openErrorModal(error: unknown) {
    const message = (error as { message?: string })?.message || 'SOS 전송에 실패했습니다.';

    openModal(
      <CommonModal
        type="error"
        tone="guardian"
        title="SOS 전송 실패"
        message={message}
        primaryButton={{ text: '확인', onClick: onCloseModal }}
        onClose={onCloseModal}
      />,
    );
  }

  function openSuccessModal(data?: Partial<WardSosResponse> | null) {
    const triggeredAt = data?.triggeredAt ?? new Date().toISOString();
    const sosEventId = data?.sosEventId ?? Date.now();
    const shouldOfferDial = wardSettings.sosAction === 'NOTIFY_GUARDIAN_FIRST';

    openModal(
      <CommonModal
        type="success"
        tone="guardian"
        title="SOS 전송 완료"
        message={
          shouldOfferDial
            ? `보호자에게 알림을 보냈습니다.\n필요하면 아래 버튼으로 119 화면을 여세요.\n${formatDateTime(triggeredAt)}`
            : `SOS 이력이 저장되었습니다.\n이력 ID ${sosEventId} · ${formatDateTime(triggeredAt)}`
        }
        primaryButton={{
          text: shouldOfferDial ? '119 화면 열기' : '확인',
          onClick: shouldOfferDial
            ? () => {
                onCloseModal();
                openDialModal();
              }
            : onCloseModal,
        }}
        secondaryButton={shouldOfferDial ? { text: '닫기', onClick: onCloseModal } : undefined}
        onClose={onCloseModal}
      />,
    );
  }

  // 2026-10-07: 확인 창 없이 탭하면 바로 전송한다. 활성 보호자가 있으면 설정값에 따라
  // 119 화면을 먼저 열거나(응답을 기다리지 않음) 완료 안내를 보여준다
  function handleHeroPress() {
    if (!isLoadingGuardians && !hasActiveGuardians) {
      openDialModal();
      return;
    }
    if (isSending) return;

    setIsSending(true);
    if (wardSettings.sosAction === 'CALL_119_AND_NOTIFY') openDialModal(true);

    triggerSosAsync(undefined)
      .then(data => {
        if (wardSettings.sosAction === 'NOTIFY_GUARDIAN_FIRST') openSuccessModal(data);
      })
      .catch(openErrorModal)
      .finally(() => setIsSending(false));
  }

  function handleGuardianCall() {
    triggerSos({ triggerType: 'GUARDIAN_CALL' }, { onError: openErrorModal });
  }

  return (
    <div className={cx('page')}>
      <button className={cx('hero')} type="button" disabled={isSending} onClick={handleHeroPress}>
        <div className={cx('heroIcon')}>
          <Icon name="alert" size={48} decorative />
        </div>
        <span className={cx('heroEyebrow')}>SOS</span>
        <h2>긴급 SOS</h2>
        <p>{isSending ? '전송 중...' : '탭하여 즉시 도움 요청'}</p>
      </button>

      <WardGuardianCallSection
        activeGuardians={activeGuardians}
        isGuardiansError={isGuardiansError}
        isLoadingGuardians={isLoadingGuardians}
        onGuardianCall={handleGuardianCall}
      />
    </div>
  );
}
