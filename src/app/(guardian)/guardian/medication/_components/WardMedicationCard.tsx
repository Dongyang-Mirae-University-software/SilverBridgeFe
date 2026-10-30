'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import useModalStore from '@/store/modalStore';
import { MedicationItem, WardMedicationSummary } from '@/service/interface/medication';
import type { DoseStatus } from '@/utils/format/medication';
import { SLOT_ORDER } from '@/utils/medication/medicationDraft';
import {
  formatDoseAmount,
  formatMedicationAlertTime,
  getDoseStatus,
  getTodayHeadline,
  getMedicationTimeSlotLabel,
  groupMedicationsByTime,
  sortMedicationsByDoseTime,
} from '@/utils/format/medication';
import {
  useDeleteGuardianMedicationMutation,
  useDeleteWardMedicationBatchMutation,
  useUpdateGuardianMedicationMutation,
  useUpdateMedicationAlertSettingMutation,
} from '@/service/query/guardian/medication';
import { guardianNotificationTypeSettingQueryOptions } from '@/service/query/guardian/notification';
import { MedicationAddModal } from './MedicationAddModal';
import { MedicationFormModal, MedicationFormValue } from './MedicationFormModal';
import { MissedAlertTimeSelect } from './MissedAlertTimeSelect';
import styles from './WardMedicationCard.module.css';

const cx = classNames.bind(styles);

interface WardMedicationCardProps {
  summary: WardMedicationSummary;
}

const DELETE_FAILED_MESSAGE = '삭제하지 못했어요. 목록을 다시 불러왔으니 확인 후 다시 시도해 주세요.';
const ALERT_SAVE_FAILED_MESSAGE = '알림 시각을 저장하지 못했어요. 다시 골라 주세요.';
// 페이지를 열어 둔 채로도 "예정" → "체크되지 않았어요"가 바뀌게 1분마다 다시 그린다(점검 L-3)
const NOW_TICK_MS = 60 * 1000;

function toUpdateBody(value: MedicationFormValue) {
  return {
    name: value.name.trim(),
    timeSlot: value.timeSlot,
    doseTime: value.doseTime ? `${value.doseTime}:00` : undefined,
    doseAmount: value.doseAmount,
    memo: value.memo,
  };
}

interface MedicationFormModalContainerProps {
  wardName: string;
  target: MedicationItem;
  onCloseModal: () => void;
}

// 약 수정(단건). 약 추가는 MedicationAddModal(카메라로 찍기·직접 쓰기, 일괄 등록)이 맡는다
function MedicationFormModalContainer({ wardName, target, onCloseModal }: MedicationFormModalContainerProps) {
  const updateMutation = useUpdateGuardianMedicationMutation();

  const handleSubmitForm = (value: MedicationFormValue) => {
    updateMutation.mutate({ medicationId: target.medicationId, body: toUpdateBody(value) }, { onSuccess: onCloseModal });
  };

  return (
    <MedicationFormModal
      wardName={wardName}
      initial={target}
      isSubmitting={updateMutation.isPending}
      errorMessage={updateMutation.isError ? '저장에 실패했습니다. 다시 시도해 주세요.' : undefined}
      onSubmit={handleSubmitForm}
      onClose={onCloseModal}
    />
  );
}

export function WardMedicationCard({ summary }: WardMedicationCardProps) {
  const { openModal, onCloseModal } = useModalStore(state => ({
    openModal: state.openModal,
    onCloseModal: state.onCloseModal,
  }));
  const deleteMutation = useDeleteGuardianMedicationMutation();
  const deleteBatchMutation = useDeleteWardMedicationBatchMutation();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // 카드는 피보호자마다 key로 새로 그려지므로(GuardianMedicationContent) 고른 시간대·삭제 확인은 이 카드 안에서만 기억한다
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const lastConfirmedRef = useRef<number | null>(null);
  const deletedIdRef = useRef<number | null>(null);
  const slotTitleRef = useRef<HTMLHeadingElement>(null);
  const emptyAddRef = useRef<HTMLButtonElement>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [, setNowTick] = useState(0);
  const alertSettingMutation = useUpdateMedicationAlertSettingMutation();
  const { data: notificationTypeSetting } = useQuery(guardianNotificationTypeSettingQueryOptions);
  const isMedicationNotificationDisabled = notificationTypeSetting?.medication.enabled === false;

  const wardName = summary.wardName ?? '피보호자';
  const medications = sortMedicationsByDoseTime(summary.medications);
  const hasMedications = medications.length > 0;
  const nowHHmm = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(new Date());
  // 같은 시간대·시각의 약은 한 번으로 센다(약 6개 × 하루 3번 = "3번 중"). 오늘 등록 전이었던 묶음은 세지 않는다
  const timeGroups = groupMedicationsByTime(medications, nowHHmm, summary.doseDate);
  // 맨 위 한 문장: "N번 중 M번" 대신 시간대로("아침 약을 다 드셨어요") - 약이 많으면 횟수가 무슨 뜻인지 알기 어렵다(2026-10-24)
  const headline = getTodayHeadline(timeGroups);
  const router = useRouter();

  // 목록은 아침·점심·저녁·취침 전 시간대 단위로 묶는다(Claude Design 2026-10-30: 위에 시간대 칸, 아래에 고른 시간대 약).
  // 같은 시간대에 서로 다른 시각의 약이 있어도 한 묶음 안에서 확인할 수 있다.
  const slotGroups = medications.reduce<typeof timeGroups>((result, medication) => {
    const slot = result.find(group => group.timeSlot === medication.timeSlot);
    if (slot) {
      slot.medications.push(medication);
      return result;
    }

    const status = getDoseStatus(medication, nowHHmm, summary.doseDate);
    result.push({
      key: medication.timeSlot,
      timeSlot: medication.timeSlot,
      doseTime: medication.doseTime,
      label: getMedicationTimeSlotLabel(medication.timeSlot),
      medications: [medication],
      takenCount: status === 'beforeRegistered' ? 0 : Number(medication.taken),
      countedCount: status === 'beforeRegistered' ? 0 : 1,
      status,
    });
    return result;
  }, []);

  slotGroups.forEach(group => {
    const statuses = group.medications.map(medication => getDoseStatus(medication, nowHHmm, summary.doseDate));
    const countedStatuses = statuses.filter(status => status !== 'beforeRegistered');
    group.takenCount = group.medications.filter((medication, index) => countedStatuses.length > 0 && statuses[index] !== 'beforeRegistered' && medication.taken).length;
    group.countedCount = countedStatuses.length;
    group.status =
      countedStatuses.length === 0
        ? 'beforeRegistered'
        : group.takenCount === countedStatuses.length
          ? 'done'
          : statuses.includes('miss')
            ? 'miss'
            : 'later';
  });

  // 칸은 아침·점심·저녁·취침 전 순서로 고정한다. 시각 순으로 두면 시간대와 시각이 어긋난 약(점심인데 오전 1:40)이
  // 있을 때 "점심 | 아침"으로 뒤집혔다(2026-10-30 gosky 실측). 같은 시간대 안의 약은 위에서 이미 시각 순이다
  slotGroups.sort((a, b) => SLOT_ORDER.indexOf(a.timeSlot) - SLOT_ORDER.indexOf(b.timeSlot));


  // 처음 고르는 시간대: 체크되지 않은 시간대 → 다음 시간대 → 첫 시간대(시안과 같은 순서)
  // "다음"은 아직 끝나지 않은 첫 시간대가 '시간 전'일 때만(앞에 체크되지 않은 시간대가 있으면 그쪽이 먼저다)
  const firstOpenGroup = slotGroups.find(group => group.status !== 'done');
  const nextSlotKey = firstOpenGroup?.status === 'later' ? firstOpenGroup.key : undefined;
  const defaultSlot =
    slotGroups.find(group => group.status === 'miss')?.key ??
    slotGroups.find(group => group.status !== 'done')?.key ??
    slotGroups[0]?.key;
  const selectedGroup = slotGroups.find(group => group.key === selectedSlot) ?? slotGroups.find(group => group.key === defaultSlot);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(tick => tick + 1), NOW_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // 단건 삭제가 끝나 그 줄이 목록에서 사라지면 시간대 제목(약이 다 없어졌으면 [첫 약 추가하기])으로 포커스를 옮긴다(점검 L-2)
  useEffect(() => {
    const deletedId = deletedIdRef.current;
    if (deletedId === null || summary.medications.some(medication => medication.medicationId === deletedId)) return;
    deletedIdRef.current = null;
    (slotTitleRef.current ?? emptyAddRef.current)?.focus();
  }, [summary.medications]);

  // 삭제 확인으로 바뀌면 [취소]로, 확인이 닫히면 그 약의 휴지통으로 포커스를 돌려준다(화면 읽기 위치를 잃지 않게)
  useEffect(() => {
    if (confirmingId !== null) {
      lastConfirmedRef.current = confirmingId;
      confirmCancelRef.current?.focus();
      return;
    }
    const last = lastConfirmedRef.current;
    lastConfirmedRef.current = null;
    if (last !== null) listRef.current?.querySelector<HTMLButtonElement>(`[data-delete-id="${last}"]`)?.focus();
  }, [confirmingId]);

  const selectSlot = (key: string) => {
    setSelectedSlot(key);
    setConfirmingId(null);
  };

  // 단건 삭제 - 시안처럼 그 줄 안에서 [취소]/[삭제]로 확인한다(2026-10-30, 전에는 window.confirm 창)
  const handleDelete = (medication: MedicationItem) => {
    setDeleteError(null);
    // 실패하면 여러 개 삭제와 같은 안내 - 전에는 아무 반응이 없었다(점검 L-2)
    deleteMutation.mutate(medication.medicationId, {
      onSuccess: () => {
        lastConfirmedRef.current = null;
        deletedIdRef.current = medication.medicationId;
        setConfirmingId(null);
      },
      onError: () => setDeleteError(DELETE_FAILED_MESSAGE),
    });
  };

  // 여러 개 삭제 - 화면에 보이는 약만 보낸다(2026-10-23). 한 번에 여러 개가 지워지므로 확인 창은 그대로 둔다
  const handleDeleteMany = (targets: MedicationItem[], question: string) => {
    if (targets.length === 0 || !window.confirm(`${question} 지난 복용 이력은 남습니다.`)) return;
    setDeleteError(null);
    deleteBatchMutation.mutate(
      { wardId: summary.wardId, medicationIds: targets.map(medication => medication.medicationId) },
      { onError: () => setDeleteError(DELETE_FAILED_MESSAGE) },
    );
  };

  const openAddMedication = () => {
    openModal(<MedicationAddModal wardId={summary.wardId} onClose={onCloseModal} />);
  };

  const openEditMedication = (target: MedicationItem) => {
    openModal(<MedicationFormModalContainer wardName={wardName} target={target} onCloseModal={onCloseModal} />);
  };

  return (
    <Fragment>
      {/* Claude Design(2026-10-30): 위에 시간대 칸, 그 아래에 고른 시간대의 약. 복용 체크는 피보호자만 한다 - 여기는 등록·수정·삭제만 */}
      {!hasMedications ? (
        <section className={cx('card', 'emptyCard')}>
          <strong className={cx('emptyTitle')}>등록된 약이 없어요</strong>
          <button ref={emptyAddRef} type="button" className={cx('primaryButton')} onClick={openAddMedication}>
            첫 약 추가하기
          </button>
        </section>
      ) : (
        <>
          {headline && (
            <p className={cx('headline')}>
              <strong className={cx('todayCount', headline.tone)}>{headline.text}</strong>
              {headline.sub && <span className={cx('todayMiss')}>{headline.sub}</span>}
            </p>
          )}

          <div className={cx('slotTiles')} role="group" aria-label="시간대 고르기" style={{ gridTemplateColumns: `repeat(${slotGroups.length}, minmax(0, 1fr))` }}>
            {slotGroups.map(group => {
              const isNext = group.key === nextSlotKey;
              const tileStatus = getTileStatus(group.status, isNext);
              return (
                <button
                  key={group.key}
                  type="button"
                  className={cx('slotTile', group.status, { selected: group.key === selectedGroup?.key })}
                  aria-pressed={group.key === selectedGroup?.key}
                  onClick={() => selectSlot(group.key)}
                >
                  <span className={cx('slotTileLabel')}>{group.label}</span>
                  {tileStatus && <span className={cx('slotTileStatus', { next: isNext })}>{tileStatus}</span>}
                </button>
              );
            })}
          </div>

          {selectedGroup && (
            <section className={cx('card', 'slotCard')} aria-labelledby={`slot-title-${summary.wardId}`}>
              <div className={cx('slotHeader')}>
                <h2 ref={slotTitleRef} id={`slot-title-${summary.wardId}`} className={cx('slotTitle')} tabIndex={-1}>
                  {selectedGroup.label} 약
                  <span className={cx('slotTime')}>{formatMedicationAlertTime(selectedGroup.doseTime)}</span>
                </h2>
                <span className={cx('slotStatus', selectedGroup.status, { next: selectedGroup.key === nextSlotKey })}>
                  {getCardStatus(selectedGroup.status, selectedGroup.key === nextSlotKey)}
                </span>
              </div>

              <ul ref={listRef} className={cx('medicationGrid')} aria-label={`${selectedGroup.label} 약 목록`}>
                {selectedGroup.medications.map(medication => {
                  const isConfirming = confirmingId === medication.medicationId;
                  // 같은 시간대 안에서 시각이 다른 약은 그 약의 시각을 함께 보여 준다
                  const ownTime = medication.doseTime !== selectedGroup.doseTime ? formatMedicationAlertTime(medication.doseTime) : null;
                  return (
                    <li
                      key={medication.medicationId}
                      className={cx('medicationItem', { confirming: isConfirming })}
                      // Esc = 취소(점검 L-1). 포커스는 확인을 닫는 효과가 휴지통으로 돌려준다
                      onKeyDown={event => {
                        if (!isConfirming || event.key !== 'Escape') return;
                        event.stopPropagation();
                        setConfirmingId(null);
                      }}
                    >
                      <span className={cx('medicationInfo')}>
                        <span className={cx('medicationTitle')}>
                          <span className={cx('medicationName')}>{medication.name}</span>
                          <span className={cx('medicationAmount')}>{formatDoseAmount(medication.doseAmount)}</span>
                        </span>
                        {isConfirming ? (
                          <span className={cx('medicationDetail')}>삭제해도 지난 복용 이력은 남아요</span>
                        ) : (
                          (ownTime || medication.memo) && (
                            <span className={cx('medicationDetail')}>{[ownTime, medication.memo].filter(Boolean).join(' · ')}</span>
                          )
                        )}
                      </span>
                      {isConfirming ? (
                        <span className={cx('medicationActions')}>
                          <button ref={confirmCancelRef} type="button" className={cx('ghostButton')} onClick={() => setConfirmingId(null)}>
                            취소
                          </button>
                          <button
                            type="button"
                            className={cx('dangerButton')}
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDelete(medication)}
                            aria-label={`${medication.name} 삭제하기`}
                          >
                            삭제
                          </button>
                        </span>
                      ) : (
                        <span className={cx('medicationActions')}>
                          <button type="button" className={cx('editButton')} onClick={() => openEditMedication(medication)} aria-label={`${medication.name} 수정`}>
                            수정
                          </button>
                          <button
                            type="button"
                            className={cx('deleteButton')}
                            data-delete-id={medication.medicationId}
                            onClick={() => {
                              setDeleteError(null);
                              setConfirmingId(medication.medicationId);
                            }}
                            aria-label={`${medication.name} 삭제`}
                          >
                            <Icon name="trash" size={17} decorative />
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {deleteError && (
            <p className={cx('deleteError')} role="alert">
              {deleteError}
            </p>
          )}
          {/* 고른 시간대 카드 안에 두면 그 시간대만 지우는 것으로 읽힌다 - 모든 시간대를 지우므로 카드 밖에 둔다(점검 M-2) */}
          {medications.length > 1 && (
            <div className={cx('listFooter')}>
              <button
                type="button"
                className={cx('dangerTextButton')}
                disabled={deleteBatchMutation.isPending}
                onClick={() => handleDeleteMany(medications, `모든 시간대의 약 ${medications.length}개를 모두 삭제할까요?`)}
              >
                모든 시간대 약 전부 삭제
              </button>
            </div>
          )}
        </>
      )}

      {/* 알림 - 시안대로 한 줄(2026-10-30): "이 시간까지 안 드시면 알려 드려요" 시각.
          어르신 기기로 가는 "약 드실 시간" 알림은 늘 보내므로 켜고 끄는 스위치가 없다(2026-10-24 사용자 결정, BE #377).
          나에게 오는 알림을 켜고 끄는 건 환경설정 > 알림 종류에서만 한다. 꺼져 있어도 시각은 미리 정해 둘 수 있게 드롭다운은 늘 둔다 */}
      <section className={cx('card', 'alertCard')} aria-label="알림 설정">
        <div className={cx('alertRow')}>
          <Icon name="bell" size={20} className={cx('alertIcon')} decorative />
          <strong className={cx('alertText')}>이 시간까지 안 드시면 알려 드려요</strong>
          <MissedAlertTimeSelect
            value={summary.missedAlertTime}
            disabled={alertSettingMutation.isPending}
            onConfirm={hhmm => {
              setAlertError(null);
              // 이 화면에는 켜고 끄는 스위치가 없으므로 시각을 정하면 이 피보호자 요약도 켠다(예전에 꺼 둔 경우 다시 받게)
              alertSettingMutation.mutate(
                { wardId: summary.wardId, body: { missedAlertTime: `${hhmm}:00`, missedAlertEnabled: true } },
                // 실패하면 버튼이 옛 시각으로 조용히 돌아가 저장된 줄 알았다 - 알린다(점검 M-1)
                { onError: () => setAlertError(ALERT_SAVE_FAILED_MESSAGE) },
              );
            }}
          />
        </div>
        {alertError && (
          <p className={cx('alertError')} role="alert">
            {alertError}
          </p>
        )}
        {isMedicationNotificationDisabled && (
          <div className={cx('notificationOff')}>
            <span>지금 약 알림이 꺼져 있어요</span>
            <button type="button" className={cx('primaryButton', 'small')} onClick={() => router.push('/guardian/settings')}>
              켜기
            </button>
          </div>
        )}
      </section>
    </Fragment>
  );
}

// 안 드셨다고 단정하지 않는다 - 체크 누락과 실제 미복용을 구분할 수 없다("체크되지 않았어요")
function getTileStatus(status: DoseStatus, isNext: boolean) {
  if (status === 'done') return '✓ 드셨어요';
  if (status === 'miss') return '체크되지 않았어요';
  if (status === 'beforeRegistered') return '등록 전';
  return isNext ? '다음' : '예정';
}

function getCardStatus(status: DoseStatus, isNext: boolean) {
  if (status === 'done') return '드셨어요';
  if (status === 'miss') return '체크되지 않았어요';
  if (status === 'beforeRegistered') return '오늘은 등록 전이었어요';
  return isNext ? '다음 약' : '예정';
}
