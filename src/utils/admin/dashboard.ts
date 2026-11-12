import { AdminAiServiceStatus, AdminDetectedType, AdminSafetyDashboard } from '@/service/interface/admin/dashboard';

export const ADMIN_ANOMALY_TYPE_META: Record<AdminDetectedType, { label: string; color: 'accent' | 'danger' | 'warn' }> = {
  FIRE: { label: '화재', color: 'danger' },
  FALL: { label: '낙상', color: 'accent' },
  WEAPON: { label: '흉기', color: 'warn' },
};

export function getDashboardPercentage(value: number, total: number) {
  return total ? Math.round(value / total * 100) : 0;
}

export function getReviewMetrics(review: AdminSafetyDashboard['todayAnomaly']['review'], total: number) {
  const answered = Math.max(0, total - review.pending);

  return {
    answered,
    responseRate: getDashboardPercentage(answered, total),
    falseAlarmRate: getDashboardPercentage(review.falseAlarm, answered),
  };
}

export function formatAdminTrendDate(value: string) {
  const [, month = '', day = ''] = value.split('-');
  return `${Number(month)}.${Number(day)}`;
}

export function formatNullableCount(value: number | null, unit: string) {
  return value === null ? '확인 불가' : `${value}${unit}`;
}

export function getAiServiceState(status: AdminAiServiceStatus | null | undefined, kind: 'anomaly' | 'chat' | 'companion', loading: boolean, error: boolean) {
  if (loading) return { label: '확인 중', tone: 'mute' };
  if (error || !status) return { label: '확인 불가', tone: 'mute' };
  const item = kind === 'anomaly' ? status.anomalyDetection : kind === 'chat' ? status.chatbot : status.companion;
  const value: unknown = item?.status ?? null;
  if (value === null) return { label: kind === 'anomaly' ? '확인 중' : '확인 불가', tone: 'mute' };
  if (value === 'OK') return { label: '정상', tone: 'safe' };
  if (kind === 'anomaly' && value === 'DISCONNECTED') return { label: '연결 끊김', tone: 'warn' };
  if (kind !== 'anomaly' && value === 'DISABLED') return { label: '일시 중단', tone: 'warn' };
  return { label: '확인 불가', tone: 'mute' };
}
