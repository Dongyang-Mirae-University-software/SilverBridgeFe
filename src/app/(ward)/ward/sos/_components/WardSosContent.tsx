'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { formatDateTime } from '@/utils/format/date';
import { useDashboard } from '@/components/layout/dashboard/DashboardContext';
import useModalStore from '@/store/modalStore';
import { useWardSosMutation } from '@/service/query/ward';
import { useWardActiveGuardians } from '@/hooks/useActiveConnections';
import type { WardSosResponse } from '@/service/interface/ward/sos';
import { Emergency119Dialpad } from './Emergency119Dialpad';
import { WardGuardianCallSection } from './WardGuardianCallSection';
import styles from './WardSosContent.module.css';

const cx = classNames.bind(styles);

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

  function openDialModal() {
    openModal(<Emergency119Dialpad onClose={onCloseModal} />);
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
    const shouldOfferDial = wardSettings.sosAction === 'NOTIFY_GUARDIAN_FIRST';

    openModal(
      <CommonModal
        type="success"
        tone="guardian"
        title="보호자에게 알렸어요"
        message={
          shouldOfferDial
            ? '필요하면 아래 버튼을 눌러 119 화면을 열어 주세요.'
            : `SOS 이력이 저장되었습니다.\n${formatDateTime(data?.triggeredAt ?? new Date().toISOString())}`
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

  // v13: 큰 SOS 버튼을 눌러도 바로 전송하지 않는다. 확인 창의 [보내기] 뒤에만 기존 전송 흐름을 실행한다.
  // 2026-10-23: 연결된 보호자가 없어도 SOS를 보내 이력을 남긴다(BE는 알림 대상 0명이면 이력만 저장).
  // 119 화면은 기다리지 않고 바로 열고, 알릴 사람이 없으니 실패해도 오류 창은 띄우지 않는다
  // 2026-10-23(사용자 결정): 119 키패드에는 보호자 알림 진행·결과 문구를 띄우지 않는다 - 키패드만 열고, 실패는 오류 창으로 알린다
  function sendConfirmedSos() {
    if (isSending) return;
    setIsSending(true);

    if (!isLoadingGuardians && !hasActiveGuardians) {
      openDialModal();
      triggerSosAsync(undefined)
        .catch(() => {})
        .finally(() => setIsSending(false));
      return;
    }

    if (wardSettings.sosAction === 'CALL_119_AND_NOTIFY') openDialModal();

    triggerSosAsync(undefined)
      .then(data => {
        if (wardSettings.sosAction === 'NOTIFY_GUARDIAN_FIRST') openSuccessModal(data);
      })
      .catch(openErrorModal)
      .finally(() => setIsSending(false));
  }

  function openConfirmModal() {
    openModal(
      <CommonModal
        type="warning"
        tone="guardian"
        actionSize="emergency"
        title="긴급 SOS를 보낼까요?"
        message="보호자에게 도움 요청을 보냅니다."
        primaryButton={{
          text: '보내기',
          onClick: () => {
            onCloseModal();
            sendConfirmedSos();
          },
        }}
        secondaryButton={{ text: '취소', onClick: onCloseModal }}
        onClose={onCloseModal}
      />,
    );
  }

  /* v12 흐름 보관: 버튼을 누르면 확인 없이 곧바로 전송했다.
  function handleHeroPress() {
    sendConfirmedSos();
  }
  */

  function handleGuardianCall() {
    triggerSos({ triggerType: 'GUARDIAN_CALL' }, { onError: openErrorModal });
  }

  return (
    <div className={cx('page')}>
      {/* v12 문구 보관: "SOS" / "도움이 필요하면 누르세요". v13은 확인 창을 거치는 두 줄 문구를 쓴다. */}
      <button className={cx('hero')} type="button" disabled={isSending} onClick={openConfirmModal}>
        <span className={cx('heroTitle')}>긴급 SOS</span>
        <span className={cx('heroSub')}>{isSending ? '보내는 중이에요…' : '누르면 도움을 요청해요'}</span>
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
