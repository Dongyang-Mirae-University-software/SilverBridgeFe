import { CSSProperties } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { MAX_WARD_FONT_SIZE, MIN_WARD_FONT_SIZE, clampFontSize } from '@/constants/wardSettings';
import { WardSettings, WardSosAction } from '@/components/layout/dashboard/types';
import { useUpdateWardSosSettingMutation } from '@/service/query/ward/sosSetting';
import { showToast } from '@/store/toastStore';

import styles from './WardBasicSettingsSection.module.css';

const cx = classNames.bind(styles);

// 2026-10-07 프로토타입: 보호자 알림은 항상 켜져 있어 끌 수 없으므로(선택지가 아님),
// "119 화면을 언제 보여줄지" 2개만 고르게 한다. CALL_119(알림 없이 119만)는 제거됨
const SOS_OPTIONS = [
  {
    value: 'CALL_119_AND_NOTIFY' as const,
    label: '119 화면 바로 열기',
    hint: '보호자에게 알리고, 119가 입력된 전화 화면을 바로 열어요.',
    isDefault: true,
  },
  {
    value: 'NOTIFY_GUARDIAN_FIRST' as const,
    label: '보호자 알림 먼저',
    hint: '보호자에게 알린 뒤, 119 전화는 화면의 버튼을 눌러서 걸어요.',
    isDefault: false,
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
  const updateSosSettingMutation = useUpdateWardSosSettingMutation();

  const handleSelect = (value: WardSosAction) => {
    const previous = wardSettings.sosAction;
    if (previous === value) return;

    updateWardSettings({ sosAction: value }); // 즉시 반영(낙관적 업데이트)
    updateSosSettingMutation.mutate(
      { sosAction: value },
      {
        onError: error => {
          updateWardSettings({ sosAction: previous }); // 실패하면 되돌림
          showToast(
            (error as { message?: string })?.message ?? 'SOS 설정을 저장하지 못했습니다. 다시 시도해 주세요.',
            { variant: 'error' },
          );
        },
      },
    );
  };

  return (
    <section className={cx('card')} aria-labelledby="s-sos">
      <div className={cx('cardHeader')}>
        <div>
          <h3 className={cx('cardTitle')} id="s-sos">
            SOS 동작 설정
          </h3>
        </div>
      </div>

      <div className={cx('guardianNotice')}>
        <Icon name="bell" size={20} className={cx('guardianNoticeIcon')} />
        <div className={cx('guardianNoticeText')}>
          <strong>보호자 알림</strong>
          <span>SOS를 누르면 연결된 보호자 모두에게 항상 알림이 가요. 알림 설정에서 푸시·문자를 꺼도 SOS는 보내져요.</span>
        </div>
        <span className={cx('guardianNoticeBadge')}>항상 켜짐</span>
      </div>

      <p className={cx('sosQuestion')}>119 화면은 어떻게 보여드릴까요?</p>

      <div className={cx('sosGroup')} role="radiogroup" aria-labelledby="s-sos">
        {SOS_OPTIONS.map(opt => {
          const isActive = wardSettings.sosAction === opt.value;
          return (
            <label key={opt.value} className={cx('sosCard', { sosCardActive: isActive })}>
              <input
                className={cx('sosInput')}
                type="radio"
                name="ward-sos"
                value={opt.value}
                checked={isActive}
                disabled={updateSosSettingMutation.isPending}
                onChange={() => handleSelect(opt.value)}
              />
              <span className={cx('sosRadio')} aria-hidden="true" />
              <span className={cx('sosText')}>
                <span className={cx('sosCardLabelRow')}>
                  <span className={cx('sosCardLabel')}>{opt.label}</span>
                  {opt.isDefault && <span className={cx('sosDefaultTag')}>기본</span>}
                </span>
                <span className={cx('sosCardHint')}>{opt.hint}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className={cx('sosFootnotes')}>
        <p>연결된 보호자가 없으면 바로 119 화면이 열려요.</p>
        <p>학생 프로젝트 화면입니다. 실제로 신고 전화가 발신되지 않습니다.</p>
      </div>
    </section>
  );
}
