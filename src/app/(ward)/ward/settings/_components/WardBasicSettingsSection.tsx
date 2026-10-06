import { CSSProperties } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { MAX_WARD_FONT_SIZE, MIN_WARD_FONT_SIZE, clampFontSize } from '@/constants/wardSettings';
import { WardSettings } from '@/components/layout/dashboard/types';

import styles from './WardBasicSettingsSection.module.css';

const cx = classNames.bind(styles);

// 세 옵션의 차이는 "보호자 알림 여부"가 아니라 "119 화면을 언제 보여줄지"다 —
// 세 옵션 모두 보호자 알림은 항상 나간다(2026-08-26 확정). CALL_119는 "전화를 건다"는
// 뜻이 아니라 "119 번호가 입력된 화면을 띄운다"는 뜻이라 라벨을 정직하게 바꿨다
const SOS_OPTIONS = [
  {
    value: 'CALL_119' as const,
    icon: 'alert' as const,
    label: '119 화면 바로 표시',
    hint: 'SOS 버튼을 누르면 곧바로 119가 입력된 화면이 뜹니다. 통화 버튼은 직접 눌러야 합니다.',
  },
  {
    value: 'CALL_119_AND_NOTIFY' as const,
    icon: 'phone' as const,
    label: '119 화면 + 보호자 알림 안내',
    hint: '119 화면이 뜨면서 보호자에게도 알림이 전달됩니다.',
  },
  {
    value: 'NOTIFY_GUARDIAN_FIRST' as const,
    icon: 'messageCircle' as const,
    label: '보호자 먼저 알린 뒤 119 안내',
    hint: '보호자에게 먼저 알린 뒤, 화면에서 119 화면으로 넘어가는 버튼을 안내합니다.',
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
