'use client';

import { useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { formatDateTime } from '@/utils/format/date';
import { useDashboard } from '@/components/layout/dashboard/DashboardContext';
import useModalStore from '@/store/modalStore';
import { useWardSosMutation } from '@/service/query/ward';
import { useWardActiveGuardians } from '@/hooks/useActiveConnections';
import type { WardSosResponse } from '@/service/interface/ward/sos';
import type { IConnectionItem } from '@/service/interface/connection';
import { Emergency119Dialpad } from '@/components/emergency/Emergency119Dialpad';
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
  const { mutateAsync: triggerSosAsync } = useWardSosMutation();
  const [isSending, setIsSending] = useState(false);
  const sendingLockRef = useRef(false);
  const guardianCallsInFlightRef = useRef(new Set<string>());

  function openDialModal() {
    openModal(<Emergency119Dialpad onClose={onCloseModal} />);
  }

  // 실패 창에서 바로 119 화면을 열거나 다시 보낼 수 있게 한다(QA CONN-A19).
  // 키패드가 이미 열려 있으면(CALL_119_AND_NOTIFY) 실패 창만 닫아 아래 키패드를 보인다
  function openErrorModal(error: unknown, { retry, dialOpen = false }: { retry: () => void; dialOpen?: boolean }) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const message = offline
      ? '인터넷이 끊겼어요. 119 화면을 열어 직접 전화해 주세요.'
      : (error as { message?: string })?.message || 'SOS 전송에 실패했습니다.';

    openModal(
      <CommonModal
        type="error"
        tone="guardian"
        title="SOS 전송 실패"
        message={message}
        primaryButton={{
          text: '119 화면 열기',
          onClick: () => {
            onCloseModal();
            if (!dialOpen) openDialModal();
          },
        }}
        secondaryButton={{
          text: '다시 보내기',
          onClick: () => {
            onCloseModal();
            retry();
          },
        }}
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

  // 2026-11-19(사용자 결정): 확인 창("긴급 SOS를 보낼까요?", v13)을 없앴다 - 긴급 상황에 창이 끼지 않게 누르면 바로 보낸다.
  // 2026-10-23: 연결된 보호자가 없어도 SOS를 보내 이력을 남긴다(BE는 알림 대상 0명이면 이력만 저장).
  // 119 화면은 기다리지 않고 바로 열고, 알릴 사람이 없으니 실패해도 오류 창은 띄우지 않는다
  // 2026-10-23(사용자 결정): 119 키패드에는 보호자 알림 진행·결과 문구를 띄우지 않는다 - 키패드만 열고, 실패는 오류 창으로 알린다
  function sendSos() {
    // isSending 은 렌더 뒤에야 바뀌어 같은 프레임의 연타를 못 막는다 - ref 로 먼저 잠근다(확인 창이 막아 주던 자리)
    if (sendingLockRef.current) return;
    sendingLockRef.current = true;
    setIsSending(true);
    const unlock = () => {
      sendingLockRef.current = false;
      setIsSending(false);
    };

    // 목록 조회가 실패했으면 보호자가 없는지 알 수 없다 - 있다고 보고 아래 흐름(실패 시 실패 창)을 탄다.
    // "보호자 없음"으로 보내면 전송 실패가 안내 없이 묻힌다(2026-11-19 점검 H-1, 목록 조회는 retry: false)
    if (!isLoadingGuardians && !isGuardiansError && !hasActiveGuardians) {
      openDialModal();
      triggerSosAsync(undefined)
        .catch(() => {})
        .finally(unlock);
      return;
    }

    const dialOpen = wardSettings.sosAction === 'CALL_119_AND_NOTIFY';
    if (dialOpen) openDialModal();

    // 인터넷이 끊겼으면 기다리지 않고 바로 실패 창을 띄운다
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      unlock();
      openErrorModal(null, { retry: sendSos, dialOpen });
      return;
    }

    triggerSosAsync(undefined)
      .then(data => {
        if (wardSettings.sosAction === 'NOTIFY_GUARDIAN_FIRST') openSuccessModal(data);
      })
      .catch(error => openErrorModal(error, { retry: sendSos, dialOpen }))
      .finally(unlock);
  }

  // 보호자 카드는 실제 전화(tel:) 링크라 전화 걸기는 막지 않는다 - 다시 누르는 것도 정상 사용이다.
  // 기록(GUARDIAN_CALL)만 그 보호자 건이 전송 중이면 건너뛴다(의도치 않은 중복 탭, 2026-11-19 점검 L-2).
  // 끝난 뒤 다시 누르면 새 기록이다 - 보호자 이력은 연타를 묶어 pressCount 로 보여 주므로 시간 간격으로 막지 않는다(policy-sos)
  function handleGuardianCall(connection: IConnectionItem) {
    const key = connection.partnerUserId;
    if (guardianCallsInFlightRef.current.has(key)) return;
    guardianCallsInFlightRef.current.add(key);
    // mutate() 의 콜백은 마지막 호출에서만 불려 다른 보호자를 이어 누르면 앞 건의 잠금이 안 풀린다 - 호출마다 끝나는 프로미스로
    triggerSosAsync({ triggerType: 'GUARDIAN_CALL', calledGuardianId: connection.partnerUserId })
      .catch(error => openErrorModal(error, { retry: () => handleGuardianCall(connection) }))
      .finally(() => {
        guardianCallsInFlightRef.current.delete(key);
      });
  }

  return (
    <div className={cx('page')}>
      {/* 화면 제목은 시안에 없어 보이지 않게 두고, 화면 읽기 프로그램·자동 점검이 찾을 수 있게 h1만 둔다 */}
      <h1 className={cx('srOnly')}>긴급 전화</h1>
      {/* v13 HTML 문구: 버튼은 "SOS / 도움이 필요하면 누르세요"로 표시한다(누르면 바로 보낸다 - 2026-11-19).
          이전 문구: "긴급 SOS / 누르면 도움을 요청해요" */}
      <button className={cx('hero')} type="button" disabled={isSending} onClick={sendSos}>
        <span className={cx('heroTitle')}>SOS</span>
        <span className={cx('heroSub')}>{isSending ? '보내는 중이에요…' : '도움이 필요하면 누르세요'}</span>
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
