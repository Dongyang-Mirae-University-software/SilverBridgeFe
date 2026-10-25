'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import { useId } from 'react';

import { Icon } from '@/components/Icon';
import {
  guardianNotificationTypeSettingQueryOptions,
  useUpdateGuardianNotificationTypeSettingMutation,
} from '@/service/query/guardian/notification';
import { GuardianNotificationTypeSetting } from '@/service/interface/guardian/notification';
import { showToast } from '@/store/toastStore';
import { SettingsLoadError } from './SettingsLoadError';
import styles from './AlertTypeSettingsSection.module.css';

const cx = classNames.bind(styles);

type ToggleableKey = 'anomalyReviewReminder' | 'medication' | 'cameraLinkLost';

const DEFAULT_SETTING: GuardianNotificationTypeSetting = {
  sos: { enabled: true, required: true },
  anomalyDetection: { enabled: true, required: true },
  anomalyReviewReminder: { enabled: true, required: false },
  medication: { enabled: true, required: false },
  cameraLinkLost: { enabled: true, required: false },
};

const SAVE_ERROR_MESSAGE = '알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
const LOCKED_REASON = '안전을 위해 끌 수 없어요';

// SOS·이상 감지 발생 알림은 BE에서 required 잠금이라 끌 수 없다 - 켜진 채 잠긴 스위치로 보여 주고 저장하지 않는다.
// 정서 변화·병원 예약 알림은 BE가 보내지 않는 알림이라 설정을 두지 않는다(거짓 설정 방지)
export function AlertTypeSettingsSection() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery(guardianNotificationTypeSettingQueryOptions);
  const setting = data ?? DEFAULT_SETTING;
  const updateMutation = useUpdateGuardianNotificationTypeSettingMutation();

  const handleToggle = (key: ToggleableKey, enabled: boolean) => {
    if (updateMutation.isPending) return;
    updateMutation.mutate({ [key]: enabled }, { onError: () => showToast(SAVE_ERROR_MESSAGE, { variant: 'error' }) });
  };

  return (
    <section className={cx('section')}>
      {isLoading ? (
        <p className={cx('loading')}>불러오는 중…</p>
      ) : isError && !data ? (
        <SettingsLoadError isRetrying={isFetching} onRetry={() => void refetch()} />
      ) : (
        <div className={cx('list')}>
          <LockedToggleRow label="SOS 알림" desc="가족이 SOS를 누르면 알려 드려요." />

          <LockedToggleRow groupHead label="이상 감지 알림" desc="화재·흉기·낙상이 감지되면 바로 알려 드려요." />

          <div className={cx('subGroup')}>
            <ToggleRow
              sub
              label="이상 감지 확인 요청"
              desc="실제 위험이었는지 응답하지 않으면 다시 확인을 요청해요. 감지 알림은 이 설정과 상관없이 항상 와요"
              checked={setting.anomalyReviewReminder.enabled}
              disabled={updateMutation.isPending}
              onChange={enabled => handleToggle('anomalyReviewReminder', enabled)}
            />
            <ToggleRow
              sub
              label="카메라 연결 끊김 안내"
              desc="카메라가 2분 넘게 연결되지 않으면 알려 드려요"
              checked={setting.cameraLinkLost?.enabled ?? true}
              disabled={updateMutation.isPending}
              onChange={enabled => handleToggle('cameraLinkLost', enabled)}
            />
          </div>

          <ToggleRow
            label="복약 알림"
            desc="약 복용 체크가 안 된 날 알려 드려요 · 알려 드릴 시간은 '복약 관리' 화면에서 정해요"
            checked={setting.medication.enabled}
            disabled={updateMutation.isPending}
            onChange={enabled => handleToggle('medication', enabled)}
          />
        </div>
      )}
    </section>
  );
}

// 끌 수 없는 필수 알림 - 다른 줄과 같은 스위치를 켜진 채 잠가 둔다(checked + disabled, onChange 없음 = 저장 요청 없음).
// disabled input은 클릭 이벤트가 나지 않아 눌러도 반응이 없으면 고장처럼 보이므로, 감싼 label에서 받아 이유를 안내한다
function LockedToggleRow({ desc, groupHead = false, label }: { desc: string; groupHead?: boolean; label: string }) {
  const reasonId = useId();

  return (
    <div className={cx('row', { groupHead })}>
      <div className={cx('meta')}>
        <div className={cx('titleRow')}>
          <span className={cx('label')}>{label}</span>
          <span className={cx('badge')}>필수</span>
        </div>
        <span className={cx('desc')}>
          {desc} <span id={reasonId} className={cx('lockedReason')}>{LOCKED_REASON}</span>
        </span>
      </div>
      <div className={cx('lockedControl')}>
        <Icon name="lock" size={14} className={cx('lockIcon')} />
        <label className={cx('toggle', 'locked')} onClick={() => showToast(`${label}은 ${LOCKED_REASON}`)}>
          <input type="checkbox" role="switch" aria-label={label} aria-describedby={reasonId} checked disabled readOnly />
          <span className={cx('toggleThumb')} aria-hidden="true" />
        </label>
      </div>
    </div>
  );
}

function ToggleRow({
  checked,
  desc,
  disabled,
  label,
  onChange,
  sub = false,
}: {
  checked: boolean;
  desc: string;
  disabled: boolean;
  label: string;
  onChange: (enabled: boolean) => void;
  sub?: boolean;
}) {
  return (
    <div className={cx('row', { subRow: sub })}>
      <div className={cx('meta')}>
        <div className={cx('titleRow')}>
          <span className={cx('label')}>{label}</span>
        </div>
        <span className={cx('desc')}>{desc}</span>
      </div>
      <label className={cx('toggle')}>
        <input
          type="checkbox"
          role="switch"
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onChange={event => onChange(event.target.checked)}
        />
        <span className={cx('toggleThumb')} aria-hidden="true" />
      </label>
    </div>
  );
}
