'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import { useId, useRef } from 'react';

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

type ToggleableKey = 'anomalyReviewReminder' | 'medication' | 'cameraLinkLost' | 'companionNotice';

const DEFAULT_SETTING: GuardianNotificationTypeSetting = {
  sos: { enabled: true, required: true },
  anomalyDetection: { enabled: true, required: true },
  anomalyReviewReminder: { enabled: true, required: false },
  medication: { enabled: true, required: false },
  cameraLinkLost: { enabled: true, required: false },
  companionRisk: { enabled: true, required: true },
  companionNotice: { enabled: true, required: false },
};

const SAVE_ERROR_MESSAGE = '알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
const LOCKED_REASON = '안전을 위해 끌 수 없어요';
// 안내 토스트가 떠 있는 동안(토스트 기본 4초)은 같은 줄의 안내를 다시 띄우지 않는다 - 연속 탭에 같은 토스트가 쌓이지 않게
const LOCKED_TOAST_INTERVAL_MS = 4000;

// SOS·이상 감지 발생·안부 대화 위험 신호 알림은 BE에서 required 잠금이라 끌 수 없다 - 켜진 채 잠긴 스위치로 보여 주고 저장하지 않는다.
// 병원 예약 알림은 BE가 보내지 않는 알림이라 설정을 두지 않는다(거짓 설정 방지)
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
        // 2026-11-26 화면 개편: 꼭 받는 알림은 위에 칸 3개(끌 수 없음), 골라서 받는 알림은 아이콘이 있는 큰 목록
        <div className={cx('list')}>
          <h3 className={cx('groupTitle')}>
            <Icon name="lock" size={15} decorative />꼭 받는 알림
          </h3>
          <div className={cx('requiredGrid')}>
            <LockedToggleTile icon="alert" tone="sos" label="SOS 알림" desc="가족이 SOS를 누르면 알려 드려요." />
            <LockedToggleTile icon="flame" tone="detect" label="이상 감지 알림" desc="화재·흉기·낙상이 감지되면 바로 알려 드려요." />
            <LockedToggleTile icon="heart" tone="mood" label="AI 기분 체크 알림" desc="안부 대화에서 위험 신호가 보이면 바로 알려 드려요." />
          </div>

          <h3 className={cx('groupTitle', 'optionalTitle')}>골라서 받는 알림</h3>
          <div className={cx('optionalList')}>
            <ToggleRow
              icon="eye"
              tone="detect"
              label="이상 감지 확인 요청"
              desc="실제 위험이었는지 응답하지 않으면 다시 알려 드려요. 감지 알림은 늘 와요"
              checked={setting.anomalyReviewReminder.enabled}
              disabled={updateMutation.isPending}
              onChange={enabled => handleToggle('anomalyReviewReminder', enabled)}
            />
            <ToggleRow
              icon="camera"
              tone="detect"
              label="카메라 연결 끊김 안내"
              desc="카메라가 2분 넘게 연결되지 않으면 알려 드려요"
              checked={setting.cameraLinkLost?.enabled ?? true}
              disabled={updateMutation.isPending}
              onChange={enabled => handleToggle('cameraLinkLost', enabled)}
            />
            <ToggleRow
              icon="pill"
              tone="med"
              label="복약 알림"
              desc="어르신 약 먹을 시간 알림과 체크 안 된 날 보호자 알림을 함께 켜고 꺼요 · 시간은 '복약 관리'에서 정해요 · 다른 보호자가 켜 두었다면 약 시간 알림은 계속 나가요"
              checked={setting.medication.enabled}
              disabled={updateMutation.isPending}
              onChange={enabled => handleToggle('medication', enabled)}
            />
            <ToggleRow
              icon="heart"
              tone="mood"
              label="기분 변화 안내"
              desc="걱정·우울한 기분이 3일 이상 이어지면 하루 한 번 알려 드려요"
              checked={setting.companionNotice?.enabled ?? true}
              disabled={updateMutation.isPending}
              onChange={enabled => handleToggle('companionNotice', enabled)}
            />
          </div>
        </div>
      )}
    </section>
  );
}

// 끌 수 없는 필수 알림 - 다른 줄과 같은 스위치를 켜진 채 잠가 둔다(checked + disabled, onChange 없음 = 저장 요청 없음).
// disabled input은 클릭 이벤트가 나지 않아 눌러도 반응이 없으면 고장처럼 보이므로, 자물쇠·스위치를 감싼 칸에서 받아 이유를 안내한다
type Tone = 'sos' | 'detect' | 'med' | 'mood';
type TileIcon = 'alert' | 'flame' | 'heart' | 'eye' | 'camera' | 'pill';

// 꼭 받는 알림 칸 - 아이콘·이름·짧은 설명 + 켜진 채 잠긴 스위치(눌러도 이유만 안내)
function LockedToggleTile({ desc, icon, label, tone }: { desc: string; icon: TileIcon; label: string; tone: Tone }) {
  const reasonId = useId();
  const lastToastAt = useRef(0);

  const showLockedReason = () => {
    const now = Date.now();
    if (now - lastToastAt.current < LOCKED_TOAST_INTERVAL_MS) return;
    lastToastAt.current = now;
    showToast(`${label}은 ${LOCKED_REASON}`);
  };

  return (
    <div className={cx('tile')}>
      <span className={cx('tileIcon', tone)} aria-hidden="true">
        <Icon name={icon} size={24} decorative />
      </span>
      <span className={cx('tileLabel')}>{label}</span>
      <span className={cx('tileDesc')}>{desc}</span>
      <div className={cx('lockedControl')} onClick={showLockedReason}>
        <Icon name="lock" size={13} className={cx('lockIcon')} />
        <span id={reasonId} className={cx('lockedReason')}>
          {LOCKED_REASON}
        </span>
        <label className={cx('toggle', 'locked', 'tileToggle')}>
          <input type="checkbox" role="switch" aria-label={label} aria-describedby={reasonId} checked disabled readOnly />
          <span className={cx('toggleThumb')} aria-hidden="true" />
        </label>
      </div>
    </div>
  );
}

// 골라서 받는 알림 줄 - 왼쪽 아이콘 칸, 큰 이름, 설명, 오른쪽 스위치
function ToggleRow({
  checked,
  desc,
  disabled,
  icon,
  label,
  onChange,
  tone,
}: {
  checked: boolean;
  desc: string;
  disabled: boolean;
  icon: TileIcon;
  label: string;
  onChange: (enabled: boolean) => void;
  tone: Tone;
}) {
  return (
    <div className={cx('row')}>
      <span className={cx('rowIcon', tone)} aria-hidden="true">
        <Icon name={icon} size={22} decorative />
      </span>
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
