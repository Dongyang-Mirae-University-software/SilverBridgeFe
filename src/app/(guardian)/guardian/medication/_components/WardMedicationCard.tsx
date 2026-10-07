'use client';

import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import useModalStore from '@/store/modalStore';
import { MedicationItem, WardMedicationSummary } from '@/service/interface/medication';
import {
  formatDoseTime,
  formatMedicationAlertTime,
  getLatestDoseTime,
  getMedicationSummaryText,
  getMedicationTimeSlotLabel,
  sortMedicationsByDoseTime,
} from '@/utils/format/medication';
import {
  useAddWardMedicationMutation,
  useDeleteGuardianMedicationMutation,
  useUpdateGuardianMedicationMutation,
  useUpdateMedicationAlertSettingMutation,
  useUpdateMedicationSettingMutation,
} from '@/service/query/guardian/medication';
import { MedicationFormModal, MedicationFormValue } from './MedicationFormModal';
import styles from './WardMedicationCard.module.css';

const cx = classNames.bind(styles);

interface WardMedicationCardProps {
  summary: WardMedicationSummary;
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

type MedicationFormTarget = 'add' | MedicationItem;

interface MedicationFormModalContainerProps {
  wardId: string;
  wardName: string;
  target: MedicationFormTarget;
  onCloseModal: () => void;
}

function MedicationFormModalContainer({ wardId, wardName, target, onCloseModal }: MedicationFormModalContainerProps) {
  const addMutation = useAddWardMedicationMutation();
  const updateMutation = useUpdateGuardianMedicationMutation();

  const handleSubmitForm = (value: MedicationFormValue) => {
    const body = toUpdateBody(value);

    if (target === 'add') {
      addMutation.mutate({ wardId, body }, { onSuccess: onCloseModal });
      return;
    }

    updateMutation.mutate({ medicationId: target.medicationId, body }, { onSuccess: onCloseModal });
  };

  const isFormSubmitting = addMutation.isPending || updateMutation.isPending;
  const formError =
    addMutation.isError || updateMutation.isError ? '저장에 실패했습니다. 다시 시도해 주세요.' : undefined;

  return (
    <MedicationFormModal
      wardName={wardName}
      initial={target === 'add' ? undefined : target}
      isSubmitting={isFormSubmitting}
      errorMessage={formError}
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

  const wardName = summary.wardName ?? '피보호자';
  const medications = sortMedicationsByDoseTime(summary.medications);
  const hasMedications = medications.length > 0;
  const showsNotificationSettings = hasMedications && summary.alarmEnabled;
  const latestDoseTime = getLatestDoseTime(summary.medications);
  const missedAlertTime = summary.missedAlertTime.slice(0, 5);
  const showsLateWarning = Boolean(latestDoseTime && `${missedAlertTime}:00` < latestDoseTime);
  const uncheckedMedications = medications.filter(medication => !medication.taken);

  const handleDelete = (medication: MedicationItem) => {
    if (!window.confirm(`${medication.name} 일정을 삭제할까요? 지난 복용 이력은 남습니다.`)) return;
    deleteMutation.mutate(medication.medicationId);
  };

  const openMedicationForm = (target: MedicationFormTarget) => {
    openModal(
      <MedicationFormModalContainer wardId={summary.wardId} wardName={wardName} target={target} onCloseModal={onCloseModal} />,
    );
  };

  return (
    <li className={cx('card')}>
      <header className={cx('profileHeader')}>
        <div className={cx('profileInfo')}>
          <UserAvatar userName={summary.wardName} size="w-60" />
          <div>
            <strong className={cx('wardName')}>
              {wardName}
              {summary.age != null && <span className={cx('age')}> 만 {summary.age}세</span>}
            </strong>
            <span className={cx('wardId')}>{summary.wardId}</span>
          </div>
        </div>
      </header>

      {hasMedications && (
        <section className={cx('todaySection')}>
          <div>
            <div className={cx('todayLabel')}>오늘</div>
            <div className={cx('todayCount')}>
              {summary.totalCount}번 중 <span className={cx('todayTaken')}>{summary.takenCount}번</span> 드셨어요
            </div>
          </div>
          <div className={cx('todayDots')}>
            {medications.map(medication => (
              <span key={medication.medicationId} title={medication.name} className={cx('todayDot', { done: medication.taken })} />
            ))}
          </div>
        </section>
      )}

      <section className={cx('scheduleSection')}>
        <div className={cx('sectionHeader')}>
          <div>
            <strong className={cx('sectionTitle')}>오늘 드실 약</strong>
            <span className={cx('sectionMeta')}>약을 드셨는지는 {wardName} 님이 직접 체크해요</span>
          </div>
          <button type="button" className={cx('addButton')} onClick={() => openMedicationForm('add')}>
            + 약 추가
          </button>
        </div>

        {!hasMedications ? (
          <p className={cx('emptyText')}>등록된 약이 없습니다.</p>
        ) : (
          <ul className={cx('medicationList')}>
            {medications.map(medication => (
              <li key={medication.medicationId} className={cx('medicationItem')}>
                <button type="button" className={cx('medicationTime')} onClick={() => openMedicationForm(medication)}>
                  <strong>{getMedicationTimeSlotLabel(medication.timeSlot)}</strong>
                  <span>{formatDoseTime(medication.doseTime)}</span>
                </button>
                <button type="button" className={cx('medicationInfo')} onClick={() => openMedicationForm(medication)}>
                  <strong className={cx('medicationName')}>{medication.name}</strong>
                  <span className={cx('medicationDetail')}>
                    {medication.doseAmount}정{medication.memo ? ` · ${medication.memo}` : ''}
                  </span>
                </button>
                <span className={cx('statusBadge', { taken: medication.taken })}>
                  {medication.taken ? '드셨어요' : '아직 안 드셨어요'}
                </span>
                <button
                  type="button"
                  className={cx('deleteButton')}
                  onClick={() => handleDelete(medication)}
                  aria-label={`${medication.name} 삭제`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasMedications && (
        <section className={cx('settingsSection')}>
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

          {showsNotificationSettings && (
            <div className={cx('settingsRow')}>
              <div className={cx('settingsMeta')}>
                <span className={cx('remindField')}>
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
                  15분 뒤 재알림
                </span>
              </div>
            </div>
          )}

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
                  value={missedAlertTime}
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

          {showsNotificationSettings && (
            <>
              <div className={cx('summaryNotice')}>
                {formatMedicationAlertTime(summary.missedAlertTime)}에 보호자에게 미복용 {uncheckedMedications.length}건
                알림 발송
              </div>

              {uncheckedMedications.length > 0 && (
                <ul className={cx('missedList')}>
                  {uncheckedMedications.map(medication => (
                    <li key={medication.medicationId}>
                      <span>{medication.name}</span>
                      <em>예정 {getMedicationSummaryText(medication)}</em>
                    </li>
                  ))}
                </ul>
              )}

              {showsLateWarning && (
                <p className={cx('alertWarning')}>
                  가장 늦은 복용 시각({formatDoseTime(latestDoseTime ?? '')})이 선택한 시각 이후라 이 약은 요약에
                  포함되지 않습니다.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </li>
  );
}
