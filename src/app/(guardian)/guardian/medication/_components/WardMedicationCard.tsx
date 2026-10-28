'use client';

import { Fragment, useState } from 'react';
import classNames from 'classnames/bind';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import useModalStore from '@/store/modalStore';
import { MedicationItem, WardMedicationSummary } from '@/service/interface/medication';
import {
  DoseStatus,
  formatDoseAmount,
  formatDoseTime,
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

const STATUS_LABEL: Record<DoseStatus, string> = {
  done: '드셨어요',
  miss: '아직 안 드셨어요',
  later: '아직 시간 전',
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
      {/* v13은 시간대 아코디언 대신 약마다 시간·이름·상태를 한 줄로 바로 보여 준다.
          추가·수정·단건/일괄 삭제 API는 기존과 동일하게 유지한다. */}
      <section className={cx('card', 'listCard')}>
        <div className={cx('sectionHeader')}>
          <div className={cx('headline')}>
            {hasMedications ? (
              <>
                <strong className={cx('todayCount', headline?.tone)}>{headline?.text ?? '오늘은 체크할 약이 없어요'}</strong>
                {headline?.sub && <span className={cx('todayMiss')}>{headline.sub}</span>}
              </>
            ) : (
              <strong className={cx('sectionTitle')}>오늘 드실 약</strong>
            )}
          </div>
          <button type="button" className={cx('addButton')} onClick={openAddMedication}>
            + 약 추가
          </button>
        </div>

        {!hasMedications ? (
          <p className={cx('emptyText')}>등록된 약이 없어요. 약을 추가해 주세요.</p>
        ) : (
          <ul className={cx('medicationList')} aria-label="오늘 드실 약">
            {medications.map(medication => {
              const status = getDoseStatus(medication, nowHHmm, summary.doseDate);
              return (
                <li key={medication.medicationId} className={cx('medicationRow')}>
                  <span className={cx('medicationTime')}>
                    {getMedicationTimeSlotLabel(medication.timeSlot)} {formatDoseTime(medication.doseTime)}
                  </span>
                  <button
                    type="button"
                    className={cx('medicationInfo', 'editable')}
                    onClick={() => openEditMedication(medication)}
                    aria-label={`${medication.name} 수정`}
                  >
                    <span className={cx('medicationName')}>{medication.name}</span>
                    <span className={cx('medicationDetail')}>
                      {formatDoseAmount(medication.doseAmount)}{medication.memo ? ` · ${medication.memo}` : ''}
                    </span>
                  </button>
                  <span className={cx('statusBadge', status)}>
                    {status === 'done' && <span aria-hidden="true">✓ </span>}
                    {STATUS_LABEL[status]}
                  </span>
                  <button
                    type="button"
                    className={cx('deleteButton')}
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDelete(medication)}
                    aria-label={`${medication.name} 삭제`}
                  >
                    <Icon name="trash" size={18} decorative />
                  </button>
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
        {/* v13 목록에는 없지만, 기존 일괄 삭제 기능은 별도 하단 동작으로 보존한다. */}
        {medications.length > 1 && (
          <div className={cx('listFooter')}>
            <button
              type="button"
              className={cx('dangerTextButton')}
              disabled={deleteBatchMutation.isPending}
              onClick={() =>
                handleDeleteMany(medications, `${wardName}의 약 ${medications.length}개를 모두 삭제할까요?`)
              }
            >
              약 전부 삭제
            </button>
          </div>
        )}
      </section>

      {/* 알림 설정 - Claude Design 시안대로(2026-10-24): "이 시간까지 안 드시면 나에게 알림" 시각.
          어르신 기기로 가는 "약 드실 시간" 알림은 늘 보내므로 켜고 끄는 스위치가 없다(2026-10-24 사용자 결정, BE #377).
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
            <div className={cx('settingsText')}>
              <strong className={cx('settingsTitle')}>이 시간까지 안 드시면 나에게 알림</strong>
              {/* 시각이 곧 집계 상한 - 이 시각까지 복용 시각이 지난 약만 센다(BE 미복용 요약) */}
              <span className={cx('settingsDescription')}>이 시각까지 체크되지 않은 약을 알려 드려요</span>
              <span className={cx('settingsDescription')}>나에게 오는 알림을 켜고 끄는 건 환경설정에서 해요</span>
            </div>
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
