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
      <FontSizeSection updateWardSettings={updateWardSettings} wardSettings={wardSettings} />
      <ContrastSection updateWardSettings={updateWardSettings} wardSettings={wardSettings} />
      <SosSection updateWardSettings={updateWardSettings} wardSettings={wardSettings} />
    </>
  );
}

function FontSizeSection({ updateWardSettings, wardSettings }: Props) {
  return (
    <div>
      <div className={cx('sectionLabel')}>글자 크기</div>
      <div className={cx('card')}>
        <div className={cx('hint')}>
          화면 글자 크기 ({MIN_WARD_FONT_SIZE}px ~ {MAX_WARD_FONT_SIZE}px)
        </div>
        <input
          type="range"
          className={cx('range')}
          min={MIN_WARD_FONT_SIZE}
          max={MAX_WARD_FONT_SIZE}
          value={wardSettings.fontSize}
          aria-label="화면 글자 크기"
          onChange={e => updateWardSettings({ fontSize: clampFontSize(Number(e.target.value)) })}
        />
        <div className={cx('hint', 'currentRow')}>
          현재: <strong className={cx('currentValue')}>{wardSettings.fontSize}px</strong> -{' '}
          <span style={{ fontSize: wardSettings.fontSize }}>글자가 이렇게 보입니다.</span>
        </div>
      </div>
    </div>
  );
}

function ContrastSection({ updateWardSettings, wardSettings }: Props) {
  return (
    <div>
      <div className={cx('sectionLabel')}>화면</div>
      <div className={cx('card')}>
        <label className={cx('checkboxRow')}>
          <input
            type="checkbox"
            className={cx('checkbox')}
            checked={wardSettings.highContrast}
            onChange={e => updateWardSettings({ highContrast: e.target.checked })}
          />
          <span className={cx('checkboxLabel')}>고대비(진한 글자) 켜기</span>
        </label>
        <div className={cx('checkboxHint')}>체크 시 글자와 테두리를 더 또렷하게 표시합니다. (이 기기에만 저장)</div>
      </div>
    </div>
  );
}

function SosSection({ updateWardSettings, wardSettings }: Props) {
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
          showToast((error as { message?: string })?.message ?? 'SOS 설정을 저장하지 못했습니다. 다시 시도해 주세요.', {
            variant: 'error',
          });
        },
      },
    );
  };

  return (
    <div>
      <div className={cx('sectionLabel')}>SOS 동작 설정</div>
      <div className={cx('card', 'sosCard')}>
        <div className={cx('guardianNotice')}>
          <span className={cx('guardianNoticeIcon')}>
            <Icon name="bell" size={20} />
          </span>
          <div className={cx('guardianNoticeText')}>
            <div className={cx('guardianNoticeTitle')}>보호자 알림</div>
            <div className={cx('guardianNoticeDesc')}>
              SOS를 누르면 연결된 보호자 모두에게 항상 알림이 가요.
              <br /> 알림 설정에서 푸시·문자를 꺼도 SOS는 보내져요.
            </div>
          </div>
          <span className={cx('guardianNoticeBadge')}>항상 켜짐</span>
        </div>

        <div className={cx('sosQuestion')}>119 화면은 어떻게 보여드릴까요?</div>

        <div role="radiogroup" aria-label="SOS 동작 설정">
          {SOS_OPTIONS.map(opt => {
            const isActive = wardSettings.sosAction === opt.value;
            return (
              <label key={opt.value} className={cx('sosOption', { sosOptionActive: isActive })}>
                <input
                  className={cx('sosRadio')}
                  type="radio"
                  name="ward-sos"
                  value={opt.value}
                  checked={isActive}
                  disabled={updateSosSettingMutation.isPending}
                  onChange={() => handleSelect(opt.value)}
                />
                <div className={cx('sosOptionBody')}>
                  <div className={cx('sosOptionLabelRow')}>
                    <span className={cx('sosOptionLabel')}>{opt.label}</span>
                    {opt.isDefault && <span className={cx('sosDefaultTag')}>기본</span>}
                  </div>
                  <div className={cx('sosOptionHint')}>{opt.hint}</div>
                </div>
              </label>
            );
          })}
        </div>

        <div className={cx('sosFootnotes')}>
          연결된 보호자가 없으면 바로 119 화면이 열려요.
          <br />
          학생 프로젝트 화면입니다. 실제로 신고 전화가 발신되지 않습니다.
        </div>
      </div>
    </div>
  );
}
