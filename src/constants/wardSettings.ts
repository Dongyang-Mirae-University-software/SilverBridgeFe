import { WardSettings, WardSosAction } from '@/components/layout/dashboard/types';

export const WARD_SETTINGS_STORAGE_KEY = 'silverbridge_ward_settings';
export const MIN_WARD_FONT_SIZE = 14;
export const MAX_WARD_FONT_SIZE = 28;

export const DEFAULT_WARD_SETTINGS: WardSettings = {
  fontSize: 17,
  highContrast: false,
  sosAction: 'CALL_119_AND_NOTIFY',
};

// CALL_119는 2026-10-07 프로토타입에서 제거됨 — 예전에 이 값을 저장해 둔 브라우저는
// 여기서 안 걸러져서 DEFAULT_WARD_SETTINGS.sosAction(기본값)으로 자동 대체된다
const VALID_SOS_ACTIONS: WardSosAction[] = ['CALL_119_AND_NOTIFY', 'NOTIFY_GUARDIAN_FIRST'];

export function clampFontSize(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_WARD_SETTINGS.fontSize;

  return Math.min(MAX_WARD_FONT_SIZE, Math.max(MIN_WARD_FONT_SIZE, value));
}

export function getValidSosAction(value: unknown): WardSosAction {
  return VALID_SOS_ACTIONS.includes(value as WardSosAction) ? (value as WardSosAction) : DEFAULT_WARD_SETTINGS.sosAction;
}

// 진한 글자로 보기를 켜면 본문 글자 굵기에 더하는 값(최대 굵기는 브라우저가 1000으로 자른다)
export const WARD_HIGH_CONTRAST_WEIGHT_BOOST = 200;

// 피보호자 본문 CSS가 쓰는 글자 배율·굵기 변수. 보통(17px) = 1배, 크게 1.24배, 아주 크게 1.47배.
// 보호자 화면에는 이 변수가 없어 CSS 기본값(1배·0)이 그대로 쓰인다.
export function getWardTextVars({ fontSize, highContrast }: Pick<WardSettings, 'fontSize' | 'highContrast'>) {
  const scale = Math.round((clampFontSize(fontSize) / DEFAULT_WARD_SETTINGS.fontSize) * 1000) / 1000;

  return {
    '--ward-font-scale': String(scale),
    '--ward-weight-boost': String(highContrast ? WARD_HIGH_CONTRAST_WEIGHT_BOOST : 0),
  };
}
