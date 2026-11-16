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

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// 저장된 설정을 읽는다. 깨진 JSON·읽기 차단이면 기본 설정을 쓰고 깨진 값은 지운다 -
// 예전에는 예외가 그대로 올라가 피보호자 화면 전체가 뜨지 않았다(QA CONN-A27)
export function readStoredWardSettings(storage: SettingsStorage | null): WardSettings {
  try {
    const raw = storage?.getItem(WARD_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_WARD_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<WardSettings> | null;
    if (!parsed || typeof parsed !== 'object') throw new Error('잘못된 설정');
    return {
      ...DEFAULT_WARD_SETTINGS,
      ...parsed,
      fontSize: clampFontSize(parsed.fontSize),
      sosAction: getValidSosAction(parsed.sosAction),
    };
  } catch {
    try {
      storage?.removeItem(WARD_SETTINGS_STORAGE_KEY);
    } catch {
      // 지우기도 막혀 있으면 그냥 기본값으로 연다
    }
    return DEFAULT_WARD_SETTINGS;
  }
}

export function writeStoredWardSettings(storage: SettingsStorage | null, settings: WardSettings) {
  try {
    storage?.setItem(WARD_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 저장이 막혀도(사생활 보호 모드·용량 초과) 화면은 계속 쓴다
  }
}

export function getWardSettingsStorage(): SettingsStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
