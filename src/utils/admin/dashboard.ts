import { AdminDetectedType, AdminSafetyDashboard } from '@/service/interface/admin/dashboard';

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
