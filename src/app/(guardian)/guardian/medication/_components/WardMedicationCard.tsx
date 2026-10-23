'use client';

import { Fragment, useState } from 'react';
import classNames from 'classnames/bind';

import { useQuery } from '@tanstack/react-query';
import useModalStore from '@/store/modalStore';
import { MedicationItem, WardMedicationSummary } from '@/service/interface/medication';
import {
  DoseStatus,
  formatDoseAmount,
  formatDoseTime,
  getDoseStatus,
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
import styles from './WardMedicationCard.module.css';

const cx = classNames.bind(styles);

interface WardMedicationCardProps {
  summary: WardMedicationSummary;
}

const DELETE_FAILED_MESSAGE = '삭제하지 못했어요. 목록을 다시 불러왔으니 확인 후 다시 시도해 주세요.';

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
  const countedGroups = groups.filter(group => group.status !== 'beforeRegistered');
  const doneGroupCount = countedGroups.filter(group => group.status === 'done').length;
  const missGroups = groups.filter(group => group.status === 'miss');
  // 체크한 약이 하나도 없는데 "모두 드셨어요"라고 하지 않는다(아직 시간 전이거나 오늘은 등록 전인 약뿐인 경우)
  const hasTaken = medications.some(medication => medication.taken);
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
            {countedGroups.length > 0 && (
              <div className={cx('todayCount')}>
                {countedGroups.length}번 중 <span className={cx('todayTaken')}>{doneGroupCount}번</span> 드셨어요
              </div>
            )}
            {missGroups.length > 0 ? (
              <div className={cx('todayMiss')}>
                {missGroups.map(group => group.label).join('·')} 약이 아직 다 체크되지 않았어요
              </div>
            ) : (
              <div className={cx('todayAllDone')}>
                {hasTaken ? '지금까지 드실 약은 모두 드셨어요' : '지금 체크할 약은 없어요'}
              </div>
            )}
          </div>
          <div className={cx('todayDots')} aria-hidden="true">
            {groups.map(group => (
              <span key={group.key} title={group.label} className={cx('todayDot', group.status)} />
            ))}
          </div>
        </section>
      )}

      <section className={cx('card', 'listCard')}>
        <div className={cx('sectionHeader')}>
          <div>
            <strong className={cx('sectionTitle')}>오늘 드실 약</strong>
            <span className={cx('sectionMeta')}>약을 드셨는지는 {wardName} 님이 직접 체크해요</span>
          </div>
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
                            <span className={cx('statusBadge', 'small', status)}>{STATUS_LABEL[status]}</span>
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

      {hasMedications && (
        <section className={cx('card', 'settingsCard')}>
          <div className={cx('settingsRow')}>
            <div className={cx('settingsMeta')}>
              <strong className={cx('settingsTitle')}>복약 시간 알림</strong>
              <span className={cx('settingsDescription')}>약 드실 시간마다 {wardName} 님께 알려 드려요</span>
            </div>
            <label className={cx('switchField')}>
              <input
                type="checkbox"
                checked={summary.alarmEnabled}
                disabled={settingMutation.isPending}
                onChange={event =>
                  settingMutation.mutate({ wardId: summary.wardId, body: { alarmEnabled: event.target.checked } })
                }
              />
              <span className={cx('switchTrack')} aria-hidden="true" />
            </label>
          </div>

          <div className={cx('settingsRow', 'settingsRowWrap')}>
            <div className={cx('settingsMeta')}>
              <strong className={cx('settingsTitle')}>안 드시면 나에게 알림</strong>
              <span className={cx('settingsDescription')}>정한 시각까지 안 드신 약이 있으면 알려 드려요</span>
            </div>
            {summary.missedAlertEnabled && (
              <label className={cx('timeField')}>
                매일
                <input
                  type="time"
                  value={summary.missedAlertTime.slice(0, 5)}
                  disabled={alertSettingMutation.isPending}
                  onChange={event =>
                    alertSettingMutation.mutate({
                      wardId: summary.wardId,
                      body: { missedAlertTime: `${event.target.value}:00` },
                    })
                  }
                />
                에 확인
              </label>
            )}
            <label className={cx('switchField', 'gold')}>
              <input
                type="checkbox"
                checked={summary.missedAlertEnabled}
                disabled={alertSettingMutation.isPending}
                onChange={event =>
                  alertSettingMutation.mutate({
                    wardId: summary.wardId,
                    body: { missedAlertEnabled: event.target.checked },
                  })
                }
              />
              <span className={cx('switchTrack')} aria-hidden="true" />
            </label>
          </div>

          {isMedicationNotificationDisabled && summary.missedAlertEnabled && (
            <p className={cx('notificationDisabledNotice')}>
              알림 종류 설정에서 복약 알림이 꺼져 있어 미복용 요약이 가지 않아요.
            </p>
          )}

          <div className={cx('settingsRow')}>
            <div className={cx('settingsMeta')}>
              <strong className={cx('settingsTitle')}>15분 뒤 재알림</strong>
              <span className={cx('settingsDescription')}>놓친 복약 알림을 15분 뒤 한 번 더 보내 드려요</span>
            </div>
            <label className={cx('switchField')}>
              <input
                type="checkbox"
                checked={summary.remindAgainEnabled}
                disabled={settingMutation.isPending}
                onChange={event =>
                  settingMutation.mutate({
                    wardId: summary.wardId,
                    body: { remindAgainEnabled: event.target.checked },
                  })
                }
              />
              <span className={cx('switchTrack')} aria-hidden="true" />
            </label>
          </div>
        </section>
      )}
    </Fragment>
  );
}
