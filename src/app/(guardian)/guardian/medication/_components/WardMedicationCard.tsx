'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { MedicationItem, WardMedicationSummary } from '@/service/interface/medication';
import { formatDoseTime, getMedicationSummaryText, sortMedicationsByDoseTime } from '@/utils/format/medication';
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

function formatAlertTime(value: string) {
  const [hourValue = '0', minuteValue = '00'] = value.split(':');
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return value.slice(0, 5);
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}:${minuteValue}`;
}

function getWardInitial(name?: string | null) {
  return name?.trim().slice(0, 1) || '피';
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
  const missedAlertTime = summary.missedAlertTime.slice(0, 5);
  const showsLateWarning = Boolean(latestDoseTime && `${missedAlertTime}:00` < latestDoseTime);
  const uncheckedMedications = medications.filter(medication => !medication.taken);

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
      <header className={cx('profileHeader')}>
        <div className={cx('profileInfo')}>
          <span className={cx('avatar')}>{getWardInitial(summary.wardName)}</span>
          <div>
            <strong className={cx('wardName')}>
              {summary.wardName ?? '피보호자'}
              {summary.age != null && <span className={cx('age')}> 만 {summary.age}세</span>}
            </strong>
            <span className={cx('wardId')}>IWD-{summary.wardId}</span>
          </div>
        </div>

        <label className={cx('switchField')}>
          <span>알림 {summary.alarmEnabled ? '켜짐' : '꺼짐'}</span>
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
      </header>

      <section className={cx('scheduleSection')}>
        <div className={cx('sectionHeader')}>
          <div>
            <strong className={cx('sectionTitle')}>복약 일정</strong>
            <span className={cx('sectionMeta')}>
              오늘 {summary.takenCount}/{summary.totalCount}회 복용 · 복용 체크는 {summary.wardName ?? '피보호자'} 님 본인만 가능
            </span>
          </div>
          <button type="button" className={cx('addButton')} onClick={() => setFormTarget('add')}>
            + 약 추가
          </button>
        </div>

        <label className={cx('remindField')}>
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

        {medications.length === 0 ? (
          <p className={cx('emptyText')}>등록된 약이 없습니다.</p>
        ) : (
          <ul className={cx('medicationList')}>
            {medications.map(medication => (
              <li key={medication.medicationId} className={cx('medicationItem', { taken: medication.taken })}>
                <button type="button" className={cx('medicationInfo')} onClick={() => setFormTarget(medication)}>
                  <strong className={cx('medicationName')}>{medication.name}</strong>
                  <span className={cx('medicationDetail')}>{getMedicationSummaryText(medication)}</span>
                </button>
                <div className={cx('medicationActions')}>
                  <span className={cx('statusBadge', { taken: medication.taken })}>
                    {medication.taken ? '복용함' : '미복용'}
                  </span>
                  <button
                    type="button"
                    className={cx('deleteButton')}
                    onClick={() => handleDelete(medication)}
                    aria-label={`${medication.name} 삭제`}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cx('missedSection')}>
        <div className={cx('missedHeader')}>
          <div className={cx('missedTitleGroup')}>
            <span className={cx('missedIcon')}>
              <Icon name="bell" size={16} decorative />
            </span>
            <div>
              <strong className={cx('missedTitle')}>미복약 알림</strong>
              <span className={cx('missedDescription')}>지정한 시각에 복용 확인이 없는 약을 보호자에게 알려 줍니다</span>
            </div>
          </div>
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

        <label className={cx('timeField')}>
          <span>발송 시각 — 하루 중 원하는 시간</span>
          <div className={cx('timeControl')}>
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
          </div>
          <em>{formatAlertTime(summary.missedAlertTime)}에 발송</em>
        </label>

        <p className={cx('sendText')}>{formatAlertTime(summary.missedAlertTime)} 발송 예정</p>
        <div className={cx('summaryNotice')}>
          {formatAlertTime(summary.missedAlertTime)}에 보호자에게 미복용 {uncheckedMedications.length}건 알림 발송
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
            가장 늦은 복용 시각({formatDoseTime(latestDoseTime ?? '')})이 선택한 시각 이후라 이 약은 요약에 포함되지 않습니다.
          </p>
        )}
      </section>

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
