import { CSSProperties } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { MAX_WARD_FONT_SIZE, MIN_WARD_FONT_SIZE, clampFontSize } from '@/constants/wardSettings';
import { WardSettings } from '@/components/layout/dashboard/types';

import styles from './WardBasicSettingsSection.module.css';

const cx = classNames.bind(styles);

const SOS_OPTIONS = [
  {
    value: 'call119' as const,
    icon: 'alert' as const,
    label: '119에 바로 연결',
    hint: 'SOS 버튼을 누르면 즉시 119에 전화를 겁니다.',
  },
  {
    value: 'call119AndNotify' as const,
    icon: 'phone' as const,
    label: '119 연결 + 보호자 알림',
    hint: '119 통화와 동시에 보호자에게 알림을 보냅니다.',
  },
  {
    value: 'notifyGuardianFirst' as const,
    icon: 'messageCircle' as const,
    label: '보호자에게 먼저 알림',
    hint: '보호자에게 먼저 알린 뒤 119 연결 방법을 안내합니다.',
  },
];

interface Props {
  updateWardSettings: (settings: Partial<WardSettings>) => void;
  wardSettings: WardSettings;
}

export function WardBasicSettingsSection({ updateWardSettings, wardSettings }: Props) {
  return (
    <>
      <FontSizeCard wardSettings={wardSettings} updateWardSettings={updateWardSettings} />
      <HighContrastCard wardSettings={wardSettings} updateWardSettings={updateWardSettings} />
      <SosActionCard wardSettings={wardSettings} updateWardSettings={updateWardSettings} />
    </>
  );
}

function FontSizeCard({ updateWardSettings, wardSettings }: Props) {
  const fontProgress = ((wardSettings.fontSize - MIN_WARD_FONT_SIZE) / (MAX_WARD_FONT_SIZE - MIN_WARD_FONT_SIZE)) * 100;
  const rangeStyle = { '--settings-range-progress': `${fontProgress}%` } as CSSProperties;

  return (
    <section className={cx('card')} aria-labelledby="s-font">
      <div className={cx('cardHeader')}>
        <div>
          <h3 className={cx('cardTitle')} id="s-font">
            글자 크기
          </h3>
          <p className={cx('cardDesc')}>슬라이더를 움직여 화면 글자 크기를 조절합니다.</p>
        </div>
      </div>

      <div className={cx('sliderWrap')}>
        <div className={cx('sliderTrack')}>
          <span className={cx('sliderLabel')}>가</span>
          <input
            type="range"
            className={cx('slider')}
            min={MIN_WARD_FONT_SIZE}
            max={MAX_WARD_FONT_SIZE}
            value={wardSettings.fontSize}
            style={rangeStyle}
            aria-label="화면 글자 크기"
            onChange={e => updateWardSettings({ fontSize: clampFontSize(Number(e.target.value)) })}
          />
          <span className={cx('sliderLabel')} style={{ fontSize: 22 }}>
            가
          </span>
        </div>

        <div className={cx('preview')}>
          <p className={cx('previewSample')} style={{ fontSize: wardSettings.fontSize }}>
            글자가 이렇게 보입니다.
          </p>
          <span className={cx('previewSize')}>{wardSettings.fontSize}px</span>
        </div>
      </div>
    </section>
  );
}

function HighContrastCard({ updateWardSettings, wardSettings }: Props) {
  return (
    <section className={cx('card')} aria-labelledby="s-contrast">
      <div className={cx('cardHeader')}>
        <div>
          <h3 className={cx('cardTitle')} id="s-contrast">
            화면 대비
          </h3>
          <p className={cx('cardDesc')}>글자와 테두리를 더 진하게 표시합니다.</p>
        </div>
      </div>

      <div className={cx('toggleRow')}>
        <div className={cx('toggleInfo')}>
          <span className={cx('toggleLabel')}>고대비 켜기</span>
          <span className={cx('toggleHint')}>시력이 불편한 경우 켜면 화면이 더 선명해집니다.</span>
        </div>
        <label className={cx('toggle')} aria-label="고대비 모드">
          <input
            type="checkbox"
            checked={wardSettings.highContrast}
            onChange={e => updateWardSettings({ highContrast: e.target.checked })}
          />
          <span className={cx('toggleThumb')} />
        </label>
      </div>

      <div className={cx('contrastPreview', { contrastPreviewOn: wardSettings.highContrast })}>
        {wardSettings.highContrast
          ? '고대비 모드가 켜져 있습니다. 글자가 더 선명하게 보입니다.'
          : '일반 모드입니다. 고대비를 켜면 글자가 더 또렷해집니다.'}
      </div>
    </section>
  );
}

function SosActionCard({ updateWardSettings, wardSettings }: Props) {
  return (
    <section className={cx('card')} aria-labelledby="s-sos">
      <div className={cx('cardHeader')}>
        <div>
          <h3 className={cx('cardTitle')} id="s-sos">
            SOS 동작 설정
          </h3>
          <p className={cx('cardDesc')}>긴급 SOS를 눌렀을 때 어떻게 동작할지 선택합니다.</p>
        </div>
      </div>

      <div className={cx('sosGroup')} role="radiogroup" aria-labelledby="s-sos">
        {SOS_OPTIONS.map(opt => {
          const isActive = wardSettings.sosAction === opt.value;
          return (
            <label key={opt.value} className={cx('sosCard', { sosCardActive: isActive })}>
              <input
                type="radio"
                name="ward-sos"
                value={opt.value}
                checked={isActive}
                onChange={() => updateWardSettings({ sosAction: opt.value })}
              />
              <Icon name={opt.icon} size={24} className={cx('sosIcon')} />
              <span className={cx('sosText')}>
                <span className={cx('sosCardLabel')}>{opt.label}</span>
                <span className={cx('sosCardHint')}>{opt.hint}</span>
              </span>
              <span className={cx('sosCheck')} aria-hidden="true" />
            </label>
          );
        })}
      </div>
    </section>
  );
}
