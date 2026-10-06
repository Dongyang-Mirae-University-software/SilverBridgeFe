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
