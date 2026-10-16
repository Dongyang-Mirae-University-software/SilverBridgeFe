'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import {
  guardianNotificationTypeSettingQueryOptions,
  useUpdateGuardianNotificationTypeSettingMutation,
} from '@/service/query/guardian/notification';
import { GuardianNotificationTypeSetting } from '@/service/interface/guardian/notification';
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

export function AlertTypeSettingsSection() {
  const { data, isLoading } = useQuery(guardianNotificationTypeSettingQueryOptions);
  const setting = data ?? DEFAULT_SETTING;
  const updateMutation = useUpdateGuardianNotificationTypeSettingMutation();

  const handleToggle = (key: ToggleableKey, enabled: boolean) => {
    updateMutation.mutate({ [key]: enabled });
  };

  return (
    <section className={cx('section')}>
      {isLoading ? (
        <p className={cx('loading')}>불러오는 중…</p>
      ) : (
        <div className={cx('list')}>
          <div className={cx('row')}>
            <div className={cx('meta')}>
              <div className={cx('titleRow')}>
                <span className={cx('label')}>SOS 알림</span>
                <span className={cx('badge')}>필수</span>
              </div>
              <span className={cx('desc')}>피보호자가 SOS를 누르면 항상 알려 드려요. 끌 수 없어요</span>
            </div>
            <label className={cx('toggle')} aria-label="SOS 알림 설정">
              <input type="checkbox" checked readOnly disabled />
              <span className={cx('toggleThumb')} />
            </label>
          </div>

          <div className={cx('row', 'groupHead')}>
            <div className={cx('meta')}>
              <div className={cx('titleRow')}>
                <span className={cx('label')}>이상 감지 알림</span>
                <span className={cx('badge')}>필수</span>
              </div>
              <span className={cx('desc')}>
                화재·흉기·낙상이 감지되면 항상 알려 드려요. 안전 알림이라 끌 수 없어요
              </span>
            </div>
            <label className={cx('toggle')} aria-label="이상 감지 알림 설정">
              <input type="checkbox" checked readOnly disabled />
              <span className={cx('toggleThumb')} />
            </label>
          </div>

          <div className={cx('subGroup')}>
            <div className={cx('row', 'subRow')}>
              <div className={cx('meta')}>
                <div className={cx('titleRow')}>
                  <span className={cx('label')}>이상 감지 확인 요청</span>
                </div>
                <span className={cx('desc')}>
                  이상 감지에 실제 위험인지 응답하지 않으면 다시 확인을 요청해요. 발생 알림 자체는 이 설정과 무관하게 항상
                  와요
                </span>
              </div>
              <label className={cx('toggle')} aria-label="이상 감지 확인 요청 알림 설정">
                <input
                  type="checkbox"
                  checked={setting.anomalyReviewReminder.enabled}
                  disabled={updateMutation.isPending}
                  onChange={event => handleToggle('anomalyReviewReminder', event.target.checked)}
                />
                <span className={cx('toggleThumb')} />
              </label>
            </div>

            <div className={cx('row', 'subRow')}>
              <div className={cx('meta')}>
                <div className={cx('titleRow')}>
                  <span className={cx('label')}>카메라 연결 끊김 안내</span>
                </div>
                <span className={cx('desc')}>
                  카메라가 2분 넘게 연결되지 않을 때 알려 드려요. 이상 감지 알림 자체는 이 설정과 무관하게 항상 와요
                </span>
              </div>
              <label className={cx('toggle')} aria-label="카메라 연결 끊김 안내 설정">
                <input
                  type="checkbox"
                  checked={setting.cameraLinkLost?.enabled ?? true}
                  disabled={updateMutation.isPending}
                  onChange={event => handleToggle('cameraLinkLost', event.target.checked)}
                />
                <span className={cx('toggleThumb')} />
              </label>
            </div>
          </div>

          <div className={cx('row')}>
            <div className={cx('meta')}>
              <div className={cx('titleRow')}>
                <span className={cx('label')}>복약 알림</span>
              </div>
              <span className={cx('desc')}>피보호자가 정해진 시간에 약을 먹지 않으면 알려 드려요</span>
            </div>
            <label className={cx('toggle')} aria-label="복약 알림 설정">
              <input
                type="checkbox"
                checked={setting.medication.enabled}
                disabled={updateMutation.isPending}
                onChange={event => handleToggle('medication', event.target.checked)}
              />
              <span className={cx('toggleThumb')} />
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
