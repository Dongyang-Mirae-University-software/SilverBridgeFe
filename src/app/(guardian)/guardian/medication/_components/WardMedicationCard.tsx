'use client';

import { Fragment } from 'react';
import classNames from 'classnames/bind';

import { useQuery } from '@tanstack/react-query';
import useModalStore from '@/store/modalStore';
import { MedicationItem, WardMedicationSummary } from '@/service/interface/medication';
import { formatDoseTime, getMedicationTimeSlotLabel, sortMedicationsByDoseTime } from '@/utils/format/medication';
import {
  useDeleteGuardianMedicationMutation,
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

type DoseStatus = 'done' | 'miss' | 'later';

const STATUS_LABEL: Record<DoseStatus, string> = {
  done: '드셨어요',
  miss: '아직 안 드셨어요',
  later: '드실 시간 전',
};

function getDoseStatus(medication: MedicationItem, nowHHmm: string): DoseStatus {
  if (medication.taken) return 'done';
  return formatDoseTime(medication.doseTime) <= nowHHmm ? 'miss' : 'later';
}

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
  const missCount = medications.filter(medication => getDoseStatus(medication, nowHHmm) === 'miss').length;

  const handleDelete = (medication: MedicationItem) => {
    if (!window.confirm(`${medication.name} 일정을 삭제할까요? 지난 복용 이력은 남습니다.`)) return;
    deleteMutation.mutate(medication.medicationId);
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
            <div className={cx('todayCount')}>
              {summary.totalCount}번 중 <span className={cx('todayTaken')}>{summary.takenCount}번</span> 드셨어요
            </div>
            {missCount > 0 ? (
              <div className={cx('todayMiss')}>드실 시간이 지난 약 {missCount}개를 아직 안 드셨어요</div>
            ) : (
              <div className={cx('todayAllDone')}>지금까지 드실 약은 모두 드셨어요</div>
            )}
          </div>
          <div className={cx('todayDots')}>
            {medications.map(medication => (
              <span
                key={medication.medicationId}
                title={medication.name}
                className={cx('todayDot', getDoseStatus(medication, nowHHmm))}
              />
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
          medications.map(medication => {
            const status = getDoseStatus(medication, nowHHmm);
            return (
              <div key={medication.medicationId} className={cx('medicationItem')}>
                <button type="button" className={cx('medicationTime')} onClick={() => openEditMedication(medication)}>
                  <strong>{getMedicationTimeSlotLabel(medication.timeSlot)}</strong>
                  <span>{formatDoseTime(medication.doseTime)}</span>
                </button>
                <button type="button" className={cx('medicationInfo')} onClick={() => openEditMedication(medication)}>
                  <strong className={cx('medicationName')}>{medication.name}</strong>
                  <span className={cx('medicationDetail')}>
                    {medication.doseAmount}정{medication.memo ? ` · ${medication.memo}` : ''}
                  </span>
                </button>
                <span className={cx('statusBadge', status)}>{STATUS_LABEL[status]}</span>
                <button
                  type="button"
                  className={cx('deleteButton')}
                  onClick={() => handleDelete(medication)}
                  aria-label={`${medication.name} 삭제`}
                >
                  ×
                </button>
              </div>
            );
          })
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
