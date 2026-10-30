// 앱 안 토스트의 종류·아이콘 규칙. 브라우저 알림(public/push-sw-logic.js)과 같아야 한다 - 테스트가 둘을 맞춰 본다
export type PushKind = 'sos' | 'anomaly' | 'medication' | 'connection' | 'default';

type PushData = Record<string, string | undefined> | undefined;

const KIND_BY_TYPE: Record<string, PushKind> = {
  WARD_SOS: 'sos',
  ANOMALY_DETECTED: 'anomaly',
  ANOMALY_REVIEW_REQUIRED: 'anomaly',
  ANOMALY_REVIEW_SUMMARY: 'anomaly',
  ANOMALY_REVIEW_CONFLICTED: 'anomaly',
  CAMERA_LINK_LOST: 'anomaly',
  MEDICATION_REMINDER: 'medication',
  MEDICATION_MISSED: 'medication',
  MEDICATION_STOPPED: 'medication',
  CONNECTION_REQUEST: 'connection',
  CONNECTION_ACCEPTED: 'connection',
  CONNECTION_REFUSED: 'connection',
  CONNECTION_FORCED: 'connection',
  CONNECTION_CANCELLED: 'connection',
  CONNECTION_DISCONNECTED: 'connection',
  DISCONNECTION: 'connection',
};

export const PUSH_KIND_LABEL: Record<PushKind, string> = {
  sos: '긴급',
  anomaly: '이상감지',
  medication: '복약',
  connection: '가족 연결',
  default: '알림',
};

const ANOMALY_GLYPH: Record<string, string> = { FIRE: 'fire', FALL: 'fall', WEAPON: 'weapon' };

export function getPushKind(data: PushData): PushKind {
  return KIND_BY_TYPE[data?.type ?? ''] ?? 'default';
}

// 토스트는 선명하게 SVG를, 브라우저 알림은 PNG를 쓴다(같은 그림)
export function getPushIconName(data: PushData) {
  const kind = getPushKind(data);
  if (kind !== 'anomaly') return `icon-${kind}`;
  return `icon-${(data?.type === 'ANOMALY_DETECTED' && ANOMALY_GLYPH[data.detectedType ?? '']) || 'anomaly'}`;
}

export function getPushIconSrc(data: PushData) {
  return `/icons/push/${getPushIconName(data)}.svg`;
}

// 복약 미복용 "N번 중 M번" - 두 값이 모두 올바를 때만
export function getMedicationProgress(data: PushData) {
  if (data?.type !== 'MEDICATION_MISSED') return null;
  const total = Number(data.totalCount);
  const missed = Number(data.missedCount);
  if (!Number.isInteger(total) || !Number.isInteger(missed) || total <= 0 || missed < 0 || missed > total) return null;
  return { total, taken: total - missed, missed };
}

// 토스트를 눌렀을 때 갈 화면 - 브라우저 알림(public/push-sw-logic.js getPath)과 같아야 한다
export function getPushRoute(data: PushData, role?: 'WARD' | 'GUARDIAN' | null) {
  switch (data?.type) {
    case 'CONNECTION_REQUEST':
      return '/ward/guardians';
    case 'CONNECTION_ACCEPTED':
    case 'CONNECTION_REFUSED':
      return '/guardian/wards';
    case 'CONNECTION_CANCELLED':
      return role === 'GUARDIAN' ? '/guardian/wards' : '/ward/guardians';
    case 'DISCONNECTION':
    case 'CONNECTION_DISCONNECTED':
    case 'CONNECTION_FORCED':
      return role === 'WARD' ? '/ward/guardians' : '/guardian/wards';
    case 'WARD_SOS':
      return '/guardian/sos';
    case 'MEDICATION_REMINDER':
      return '/ward/medication';
    case 'MEDICATION_MISSED':
    case 'MEDICATION_STOPPED':
      return '/guardian/medication';
    case 'ANOMALY_DETECTED':
      if (role === 'WARD') return '/ward';
      return data?.sessionId ? `/guardian/detection?session=${encodeURIComponent(data.sessionId)}` : '/guardian/detection';
    case 'ANOMALY_REVIEW_REQUIRED':
    case 'ANOMALY_REVIEW_SUMMARY':
    case 'ANOMALY_REVIEW_CONFLICTED':
    case 'CAMERA_LINK_LOST':
      return '/guardian/detection';
    case 'INQUIRY_ANSWERED':
      return '/guardian/inquiries';
    default:
      return role === 'WARD' ? '/ward' : '/guardian';
  }
}

export function formatReceivedAt(receivedAt: number, now: number) {
  const minutes = Math.floor((now - receivedAt) / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  return `${Math.floor(minutes / 60)}시간 전`;
}
