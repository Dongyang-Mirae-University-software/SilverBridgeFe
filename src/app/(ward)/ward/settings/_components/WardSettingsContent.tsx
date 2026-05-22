'use client';

import { CSSProperties } from 'react';

import { useDashboard } from '@/app/_common/layout/dashboard/DashboardContext';
import { cx } from '@/app/_common/layout/dashboard/styles';
import {
  MAX_WARD_FONT_SIZE,
  MIN_WARD_FONT_SIZE,
  WARD_SOS_OPTIONS,
  clampFontSize,
} from '@/app/constant/wardSettings';

export function WardSettingsContent() {
  const { updateWardSettings, wardSettings } = useDashboard();
  const fontRangeProgress = ((wardSettings.fontSize - MIN_WARD_FONT_SIZE) / (MAX_WARD_FONT_SIZE - MIN_WARD_FONT_SIZE)) * 100;
  const rangeStyle = { '--settings-range-progress': `${fontRangeProgress}%` } as CSSProperties;

  return (
    <section className={cx('settingsPage')} aria-labelledby="ward-settings-title">
      <div className={cx('settingsHeader')}>
        <span className={cx('eyebrow')}>피보호자 전용</span>
        <h2 id="ward-settings-title">환경설정</h2>
        <p>글자 크기, 화면 대비, 긴급 SOS 동작 방식을 이 기기에 저장합니다.</p>
      </div>

      <div className={cx('settingsStack')}>
        <section className={cx('settingsCard')} aria-labelledby="ward-font-size-title">
          <div className={cx('settingsCardHeader')}>
            <span className={cx('settingsNumber')}>1</span>
            <div>
              <h3 id="ward-font-size-title">글자 크기</h3>
              <p>화면 글자 크기 ({MIN_WARD_FONT_SIZE}px ~ {MAX_WARD_FONT_SIZE}px)</p>
            </div>
          </div>
          <input
            className={cx('settingsRange')}
            type="range"
            min={MIN_WARD_FONT_SIZE}
            max={MAX_WARD_FONT_SIZE}
            value={wardSettings.fontSize}
            aria-label="화면 글자 크기"
            style={rangeStyle}
            onChange={event => updateWardSettings({ fontSize: clampFontSize(Number(event.target.value)) })}
          />
          <p className={cx('settingsPreview')} style={{ fontSize: `${wardSettings.fontSize}px` }}>
            현재: <strong>{wardSettings.fontSize}px</strong> — 글자가 이렇게 보입니다.
          </p>
        </section>

        <section className={cx('settingsCard')} aria-labelledby="ward-display-title">
          <div className={cx('settingsCardHeader')}>
            <span className={cx('settingsNumber')}>2</span>
            <div>
              <h3 id="ward-display-title">화면</h3>
              <p>화면의 글자와 테두리 표시 방식을 조정합니다.</p>
            </div>
          </div>
          <label className={cx('settingsCheckRow')}>
            <input type="checkbox" checked={wardSettings.highContrast} onChange={event => updateWardSettings({ highContrast: event.target.checked })} />
            <span>고대비(진한 글자) 켜기</span>
          </label>
          <p className={cx('settingsHelp')}>체크 시 글자와 테두리를 더 또렷하게 표시합니다. (이 기기에만 저장)</p>
        </section>

        <section className={cx('settingsCard')} aria-labelledby="ward-sos-title">
          <div className={cx('settingsCardHeader')}>
            <span className={cx('settingsNumber')}>3</span>
            <div>
              <h3 id="ward-sos-title">SOS 동작 설정</h3>
              <p>긴급 SOS를 눌렀을 때 어떻게 동작할지 선택합니다.</p>
            </div>
          </div>
          <div className={cx('settingsRadioGroup')} role="radiogroup" aria-labelledby="ward-sos-title">
            {WARD_SOS_OPTIONS.map(option => (
              <label key={option.value} className={cx('settingsRadioCard', { active: wardSettings.sosAction === option.value })}>
                <input type="radio" name="ward-sos-action" value={option.value} checked={wardSettings.sosAction === option.value} onChange={() => updateWardSettings({ sosAction: option.value })} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
