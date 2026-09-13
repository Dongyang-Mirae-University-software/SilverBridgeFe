'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { MedicationItem, WardMedicationSummary } from '@/service/interface/medication';
import { formatDoseTime, getMedicationTimeSlotLabel, sortMedicationsByDoseTime } from '@/utils/format/medication';
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

function getLatestDoseTime(medications: MedicationItem[]) {
  if (medications.length === 0) return null;
  return medications.reduce((latest, medication) => (medication.doseTime > latest ? medication.doseTime : latest), '00:00:00');
}

export function WardMedicationCard({ summary }: WardMedicationCardProps) {
  const [formTarget, setFormTarget] = useState<'add' | MedicationItem | null>(null);

  const addMutation = useAddWardMedicationMutation();
  const updateMutation = useUpdateGuardianMedicationMutation();
  const deleteMutation = useDeleteGuardianMedicationMutation();
  const settingMutation = useUpdateMedicationSettingMutation();
  const alertSettingMutation = useUpdateMedicationAlertSettingMutation();

  const medications = sortMedicationsByDoseTime(summary.medications);
  const latestDoseTime = getLatestDoseTime(summary.medications);
  const showsLateWarning = Boolean(latestDoseTime && `${summary.missedAlertTime.slice(0, 5)}:00` < latestDoseTime);

  const handleSubmitForm = (value: MedicationFormValue) => {
    const body = toUpdateBody(value);

    if (formTarget === 'add') {
      addMutation.mutate(
        { wardId: summary.wardId, body },
        { onSuccess: () => setFormTarget(null) },
      );
      return;
    }

    if (formTarget) {
      updateMutation.mutate(
        { medicationId: formTarget.medicationId, body },
        { onSuccess: () => setFormTarget(null) },
      );
    }
  };

  const handleDelete = (medication: MedicationItem) => {
    if (!window.confirm(`${medication.name} 일정을 삭제할까요? 지난 복용 이력은 남습니다.`)) return;
    deleteMutation.mutate(medication.medicationId);
  };

  const isFormSubmitting = addMutation.isPending || updateMutation.isPending;
  const formError = addMutation.isError || updateMutation.isError ? '저장에 실패했습니다. 다시 시도해 주세요.' : undefined;

  return (
    <li className={cx('card')}>
      <header className={cx('header')}>
        <div>
          <strong className={cx('wardName')}>
            {summary.wardName ?? '피보호자'}
            {summary.age != null && <span className={cx('age')}> · {summary.age}세</span>}
          </strong>
          <span className={cx('countBadge')}>
            오늘 {summary.takenCount}/{summary.totalCount}회 복용
          </span>
        </div>
        <button type="button" className={cx('addButton')} onClick={() => setFormTarget('add')}>
          + 약 추가
        </button>
      </header>

      <div className={cx('settingRow')}>
        <label className={cx('toggleField')}>
          <input
            type="checkbox"
            checked={summary.alarmEnabled}
            disabled={settingMutation.isPending}
            onChange={event =>
              settingMutation.mutate({ wardId: summary.wardId, body: { alarmEnabled: event.target.checked } })
            }
          />
          복용 알림
        </label>
        <label className={cx('toggleField')}>
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
        </label>
      </div>

      <div className={cx('alertRow')}>
        <label className={cx('toggleField')}>
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
          미복용 요약 받기
        </label>
        <input
          type="time"
          className={cx('timeInput')}
          value={summary.missedAlertTime.slice(0, 5)}
          disabled={alertSettingMutation.isPending}
          onChange={event =>
            alertSettingMutation.mutate({
              wardId: summary.wardId,
              body: { missedAlertTime: `${event.target.value}:00` },
            })
          }
        />
      </div>
      <p className={cx('alertHint')}>선택한 시각 이후 복용 예정인 약은 그날 요약에 포함되지 않습니다.</p>
      {showsLateWarning && (
        <p className={cx('alertWarning')}>
          가장 늦은 복용 시각({formatDoseTime(latestDoseTime ?? '')})이 선택한 시각 이후라 이 약은 요약에 포함되지 않습니다.
        </p>
      )}

      {medications.length === 0 ? (
        <p className={cx('emptyText')}>등록된 약이 없습니다.</p>
      ) : (
        <ul className={cx('list')}>
          {medications.map(medication => (
            <li key={medication.medicationId} className={cx('item', { taken: medication.taken })}>
              <div className={cx('itemMeta')}>
                <span className={cx('itemSlot')}>
                  {getMedicationTimeSlotLabel(medication.timeSlot)} {formatDoseTime(medication.doseTime)}
                </span>
                <strong className={cx('itemName')}>{medication.name}</strong>
                <span className={cx('itemDetail')}>
                  {medication.doseAmount}정{medication.memo ? ` · ${medication.memo}` : ''}
                </span>
              </div>
              <div className={cx('itemActions')}>
                <span className={cx('checkBadge', { checked: medication.taken })}>
                  {medication.taken ? '체크됨' : '미체크'}
                </span>
                <button type="button" className={cx('linkButton')} onClick={() => setFormTarget(medication)}>
                  수정
                </button>
                <button type="button" className={cx('linkButton', 'danger')} onClick={() => handleDelete(medication)}>
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formTarget && (
        <MedicationFormModal
          wardName={summary.wardName ?? '피보호자'}
          initial={formTarget === 'add' ? undefined : formTarget}
          isSubmitting={isFormSubmitting}
          errorMessage={formError}
          onSubmit={handleSubmitForm}
          onClose={() => setFormTarget(null)}
        />
      )}
    </li>
  );
}
