'use client';

import { Fragment, useState } from 'react';
import classNames from 'classnames/bind';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import useModalStore from '@/store/modalStore';
import { MedicationItem, WardMedicationSummary } from '@/service/interface/medication';
import {
  DoseStatus,
  formatDoseAmount,
  formatDoseTime,
  getDoseStatus,
  getTodayHeadline,
  getMedicationTimeSlotLabel,
  getTimeGroupStatusLabel,
  groupMedicationsByTime,
  sortMedicationsByDoseTime,
  summarizeMedicationNames,
} from '@/utils/format/medication';
import {
  useDeleteGuardianMedicationMutation,
  useDeleteWardMedicationBatchMutation,
  useUpdateGuardianMedicationMutation,
  useUpdateMedicationAlertSettingMutation,
  useUpdateMedicationSettingMutation,
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

// 맨 위 시간대 이름표의 스크린리더용 짧은 상태(목록의 상태 문구와 겹치지 않게 짧게)
const SLOT_STATUS_SHORT: Record<DoseStatus, string> = {
  done: '다 드심',
  miss: '체크 전',
  later: '시간 전',
  beforeRegistered: '등록 전',
};

const STATUS_LABEL: Record<DoseStatus, string> = {
  done: '드셨어요',
  miss: '아직 체크 전이에요',
  later: '드실 시간 전',
  beforeRegistered: '오늘은 등록 전이었어요',
};

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
  const settingMutation = useUpdateMedicationSettingMutation();
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
  const groups = groupMedicationsByTime(medications, nowHHmm, summary.doseDate);
  // 맨 위 한 문장: "N번 중 M번" 대신 시간대로("아침 약을 다 드셨어요") - 약이 많으면 횟수가 무슨 뜻인지 알기 어렵다(2026-10-24)
  const headline = getTodayHeadline(groups);
  const router = useRouter();
  const [openGroupKeys, setOpenGroupKeys] = useState<string[]>([]);
  const toggleGroup = (key: string) =>
    setOpenGroupKeys(keys => (keys.includes(key) ? keys.filter(item => item !== key) : [...keys, key]));

  const handleDelete = (medication: MedicationItem) => {
    if (!window.confirm(`${medication.name} 일정을 삭제할까요? 지난 복용 이력은 남습니다.`)) return;
    setDeleteError(null);
    // 실패하면 여러 개 삭제와 같은 안내 - 전에는 아무 반응이 없었다(점검 L-2)
    deleteMutation.mutate(medication.medicationId, { onError: () => setDeleteError(DELETE_FAILED_MESSAGE) });
  };

  // 여러 개 삭제 - 시간대 묶음("아침 약 모두 삭제") 또는 전부. 화면에 보이는 약만 보낸다(2026-10-23)
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
      {hasMedications && (
        <section className={cx('card', 'todayCard')}>
          <div>
            <div className={cx('todayLabel')}>오늘</div>
            <div className={cx('todayCount', headline?.tone)}>{headline?.text ?? '오늘은 체크할 약이 없어요'}</div>
            {headline?.sub && <div className={cx('todayMiss')}>{headline.sub}</div>}
          </div>
          {/* 시간대마다 이름표 - 점만으로는 무엇인지 알 수 없었다 */}
          <ul className={cx('todaySlots')} aria-label="시간대별 상태">
            {groups.map(group => (
              <li key={group.key} className={cx('todaySlot', group.status)}>
                {group.status === 'done' && <span aria-hidden="true">✓ </span>}
                {group.label}
                <span className={cx('srOnly')}> {SLOT_STATUS_SHORT[group.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={cx('card', 'listCard')}>
        <div className={cx('sectionHeader')}>
          <strong className={cx('sectionTitle')}>오늘 드실 약</strong>
          <button type="button" className={cx('addButton')} onClick={openAddMedication}>
            + 약 추가
          </button>
        </div>

        {!hasMedications ? (
          <p className={cx('emptyText')}>등록된 약이 없어요. 약을 추가해 주세요.</p>
        ) : (
          <ul className={cx('groupList')}>
            {groups.map(group => {
              const isOpen = openGroupKeys.includes(group.key);
              const panelId = `medication-group-${summary.wardId}-${group.key}`;
              return (
                <li key={group.key} className={cx('groupItem')}>
                  <button
                    type="button"
                    className={cx('groupHeader')}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <span className={cx('groupTime')}>
                      <strong>{getMedicationTimeSlotLabel(group.timeSlot)}</strong>
                      <span>{formatDoseTime(group.doseTime)}</span>
                    </span>
                    <span className={cx('groupInfo')}>
                      <strong>약 {group.medications.length}개</strong>
                      <span>{summarizeMedicationNames(group.medications)}</span>
                    </span>
                    <span className={cx('statusBadge', group.status)}>{getTimeGroupStatusLabel(group)}</span>
                    <span className={cx('chevron', { open: isOpen })} aria-hidden="true">
                      ›
                    </span>
                  </button>
                  {isOpen && (
                    <ul id={panelId} className={cx('groupMedications')}>
                      {group.medications.map(medication => {
                        const status = getDoseStatus(medication, nowHHmm, summary.doseDate);
                        return (
                          <li key={medication.medicationId} className={cx('medicationItem')}>
                            <button
                              type="button"
                              className={cx('medicationInfo')}
                              onClick={() => openEditMedication(medication)}
                              aria-label={`${medication.name} 수정`}
                            >
                              <strong className={cx('medicationName')}>{medication.name}</strong>
                              <span className={cx('medicationDetail')}>
                                {formatDoseAmount(medication.doseAmount)}
                                {medication.memo ? ` · ${medication.memo}` : ''}
                              </span>
                            </button>
                            {/* 시간대 줄과 같은 상태면 약마다 되풀이하지 않는다 - 다른 약만 보인다(그 약만 드셨어요 등, 2026-10-24) */}
                            {status !== group.status && (
                              <span className={cx('statusBadge', 'small', status)}>{STATUS_LABEL[status]}</span>
                            )}
                            <button
                              type="button"
                              className={cx('deleteButton')}
                              onClick={() => handleDelete(medication)}
                              aria-label={`${medication.name} 삭제`}
                            >
                              삭제
                            </button>
                          </li>
                        );
                      })}
                      {group.medications.length > 1 && (
                        <li className={cx('groupActions')}>
                          <button
                            type="button"
                            className={cx('dangerTextButton')}
                            disabled={deleteBatchMutation.isPending}
                            onClick={() =>
                              handleDeleteMany(
                                group.medications,
                                `${group.label} 약 ${group.medications.length}개를 모두 삭제할까요?`,
                              )
                            }
                          >
                            {group.label} 약 모두 삭제
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {deleteError && (
          <p className={cx('deleteError')} role="alert">
            {deleteError}
          </p>
        )}
        {medications.length > 1 && (
          <div className={cx('listFooter')}>
            <button
              type="button"
              className={cx('dangerTextButton')}
              disabled={deleteBatchMutation.isPending}
              onClick={() =>
                handleDeleteMany(medications, `${wardName} 님의 약 ${medications.length}개를 모두 삭제할까요?`)
              }
            >
              약 전부 삭제
            </button>
          </div>
        )}
      </section>

      {/* 알림 설정 - Claude Design 시안대로(2026-10-24): 어르신 기기 알림 스위치 + "이 시간까지 안 드시면 나에게 알림" 시각.
          나에게 오는 알림을 켜고 끄는 건 환경설정 > 알림 종류에서만 한다(이 화면에 같은 스위치를 두지 않는다) */}
      {hasMedications && (
        <section className={cx('card', 'settingsCard')}>
          <strong className={cx('settingsCardTitle')}>알림 설정</strong>
          {isMedicationNotificationDisabled && (
            <div className={cx('notificationOff')}>
              <span>지금 복약 알림을 받지 않고 있어요</span>
              <button type="button" className={cx('notificationOffButton')} onClick={() => router.push('/guardian/settings')}>
                켜기
              </button>
            </div>
          )}
          <div className={cx('settingsRow')}>
            <strong className={cx('settingsTitle')}>{wardName} 님께 약 드실 시간 알려 드리기</strong>
            <label className={cx('switchField')}>
              <input
                type="checkbox"
                aria-label={`${wardName} 님께 약 드실 시간 알려 드리기`}
                checked={summary.alarmEnabled}
                disabled={settingMutation.isPending}
                onChange={event =>
                  settingMutation.mutate({ wardId: summary.wardId, body: { alarmEnabled: event.target.checked } })
                }
              />
              <span className={cx('switchTrack')} aria-hidden="true" />
            </label>
          </div>
          <div className={cx('settingsRow')}>
            <strong className={cx('settingsTitle')}>이 시간까지 안 드시면 나에게 알림</strong>
            <MissedAlertTimeSelect
              value={summary.missedAlertTime}
              disabled={alertSettingMutation.isPending}
              onConfirm={hhmm =>
                // 이 화면에는 켜고 끄는 스위치가 없으므로 시각을 정하면 이 피보호자 요약도 켠다(예전에 꺼 둔 경우 다시 받게)
                alertSettingMutation.mutate({
                  wardId: summary.wardId,
                  body: { missedAlertTime: `${hhmm}:00`, missedAlertEnabled: true },
                })
              }
            />
          </div>
        </section>
      )}
    </Fragment>
  );
}
