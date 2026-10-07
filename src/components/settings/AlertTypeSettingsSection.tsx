'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import styles from './AlertTypeSettingsSection.module.css';

const cx = classNames.bind(styles);

interface AlertToggleOption {
  key: string;
  label: string;
  desc: string;
  badge?: string;
  disabled?: boolean;
}

const ALERT_OPTIONS: AlertToggleOption[] = [
  {
    key: 'sos',
    label: 'SOS 알림',
    desc: '피보호자가 SOS를 누르면 알려 드려요. 항상 켜져 있어요',
    badge: '필수',
    disabled: true,
  },
  {
    key: 'detection',
    label: '이상 감지 알림',
    desc: '화재·흉기·낙상이 감지되면 바로 알려 드려요',
  },
  {
    key: 'medication',
    label: '복약 알림',
    desc: '피보호자가 정해진 시간에 약을 먹지 않으면 알려 드려요',
  },
  {
    key: 'emotion',
    label: '정서 변화 알림',
    desc: 'AI 안부 말벗 대화에서 우울하거나 걱정하는 감정이 계속되면 알려 드려요',
  },
  {
    key: 'hospital',
    label: '병원 예약 알림',
    desc: '예약 하루 전과 당일에 알려 드려요',
  },
];

const DEFAULT_ENABLED: Record<string, boolean> = {
  sos: true,
  detection: true,
  medication: true,
  emotion: false,
  hospital: true,
};

export function AlertTypeSettingsSection() {
  const [enabledMap, setEnabledMap] = useState(DEFAULT_ENABLED);

  const handleToggle = (key: string) => {
    setEnabledMap(current => ({ ...current, [key]: !current[key] }));
  };

  return (
    <section className={cx('section')}>
      <div className={cx('sectionHead')}>
        <h2 className={cx('sectionTitle')}>알림 종류</h2>
        <p className={cx('sectionDesc')}>어떤 상황에 알림을 받을지 선택할 수 있습니다.</p>
      </div>

      <div className={cx('list')}>
        {ALERT_OPTIONS.map(option => (
          <div key={option.key} className={cx('row')}>
            <div className={cx('meta')}>
              <div className={cx('titleRow')}>
                <span className={cx('label')}>{option.label}</span>
                {option.badge && <span className={cx('badge')}>{option.badge}</span>}
              </div>
              <span className={cx('desc')}>{option.desc}</span>
            </div>
            <label className={cx('toggle')} aria-label={`${option.label} 설정`}>
              <input
                type="checkbox"
                checked={enabledMap[option.key]}
                disabled={option.disabled}
                onChange={() => handleToggle(option.key)}
              />
              <span className={cx('toggleThumb')} />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
