// 알림 창의 "알림 종류" 고르기(2026-11-26) - 기본은 전체, 고르면 그 종류만 서버에서 다시 받는다(BE type 필터, #528).
// 값은 서버 NotificationType 이름 그대로다. 역할마다 실제로 받을 수 있는 종류만 둔다(받지 않는 종류를 고르면 늘 빈 목록이라).

export interface NotificationTypeOption {
  value: string;
  label: string;
}

export const ALL_NOTIFICATION_TYPES = 'ALL';

const GUARDIAN_TYPES: NotificationTypeOption[] = [
  { value: 'WARD_SOS', label: '긴급 SOS' },
  { value: 'ANOMALY_DETECTED', label: '이상 감지' },
  { value: 'ANOMALY_REVIEW_REQUIRED', label: '감지 판정 요청' },
  { value: 'ANOMALY_REVIEW_CONFLICTED', label: '감지 판정 재확인' },
  { value: 'CAMERA_LINK_LOST', label: '카메라 연결 끊김' },
  { value: 'COMPANION_RISK', label: '안부 말벗 위험 신호' },
  { value: 'COMPANION_RISK_PATTERN', label: '안부 말벗 위험 누적' },
  { value: 'COMPANION_NOTICE', label: '안부 말벗 기분 변화' },
  { value: 'MEDICATION_MISSED', label: '복약 확인 요약' },
  { value: 'MEDICATION_STOPPED', label: '복약 일정 중지' },
  { value: 'CONNECTION_ACCEPTED', label: '연결 수락' },
  { value: 'CONNECTION_REFUSED', label: '연결 거절' },
  { value: 'CONNECTION_DISCONNECTED', label: '연결 해제' },
  { value: 'CONNECTION_FORCED', label: '관리자 연결' },
  { value: 'INQUIRY_ANSWERED', label: '문의 답변' },
];

const WARD_TYPES: NotificationTypeOption[] = [
  { value: 'ANOMALY_DETECTED_SELF', label: '이상 감지' },
  { value: 'MEDICATION_REMINDER', label: '약 드실 시간' },
  { value: 'COMPANION_PROMPT', label: '안부 말벗 시간' },
  { value: 'CONNECTION_REQUEST', label: '연결 요청' },
  { value: 'CONNECTION_DISCONNECTED', label: '연결 해제' },
  { value: 'CONNECTION_FORCED', label: '관리자 연결' },
];

export function notificationTypeOptions(role: 'GUARDIAN' | 'WARD'): NotificationTypeOption[] {
  return [{ value: ALL_NOTIFICATION_TYPES, label: '전체' }, ...(role === 'GUARDIAN' ? GUARDIAN_TYPES : WARD_TYPES)];
}
