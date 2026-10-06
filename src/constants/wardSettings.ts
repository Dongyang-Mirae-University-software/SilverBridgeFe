import { WardSettings, WardSosAction } from '@/components/layout/dashboard/types';

export const WARD_SETTINGS_STORAGE_KEY = 'silverbridge_ward_settings';
export const MIN_WARD_FONT_SIZE = 14;
export const MAX_WARD_FONT_SIZE = 28;

export const DEFAULT_WARD_SETTINGS: WardSettings = {
  fontSize: 17,
  highContrast: false,
  sosAction: 'CALL_119_AND_NOTIFY',
};

const VALID_SOS_ACTIONS: WardSosAction[] = ['CALL_119', 'CALL_119_AND_NOTIFY', 'NOTIFY_GUARDIAN_FIRST'];

export function clampFontSize(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_WARD_SETTINGS.fontSize;

  return Math.min(MAX_WARD_FONT_SIZE, Math.max(MIN_WARD_FONT_SIZE, value));
}

export function getValidSosAction(value: unknown): WardSosAction {
  return VALID_SOS_ACTIONS.includes(value as WardSosAction) ? (value as WardSosAction) : DEFAULT_WARD_SETTINGS.sosAction;
}
