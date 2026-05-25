import { WardSettings, WardSosAction } from '@/components/layout/dashboard/types';

export const WARD_SETTINGS_STORAGE_KEY = 'silverbridge_ward_settings';
export const MIN_WARD_FONT_SIZE = 14;
export const MAX_WARD_FONT_SIZE = 28;

export const DEFAULT_WARD_SETTINGS: WardSettings = {
  fontSize: 17,
  highContrast: false,
  sosAction: 'call119AndNotify',
};

export const WARD_SOS_OPTIONS: Array<{ label: string; value: WardSosAction }> = [
  { value: 'call119', label: '119에 바로 연결' },
  { value: 'call119AndNotify', label: '119 연결과 동시에 보호자에게 알림' },
  { value: 'notifyGuardianFirst', label: '보호자에게 먼저 알림한 뒤 119 연결 안내' },
];

export function clampFontSize(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_WARD_SETTINGS.fontSize;

  return Math.min(MAX_WARD_FONT_SIZE, Math.max(MIN_WARD_FONT_SIZE, value));
}

export function getValidSosAction(value: unknown): WardSosAction {
  return WARD_SOS_OPTIONS.some(option => option.value === value)
    ? (value as WardSosAction)
    : DEFAULT_WARD_SETTINGS.sosAction;
}
