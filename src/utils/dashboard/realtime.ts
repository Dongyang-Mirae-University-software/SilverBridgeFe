import { ConnectionRealtimePayload } from '@/lib/realtime/connectionSocket';
import { getAnomalyAlertText } from '@/utils/anomaly/alertText';
import { getSubjectParticle } from '@/utils/format/korean';

export function getRealtimeNotification(payload: ConnectionRealtimePayload, role?: 'WARD' | 'GUARDIAN') {
  switch (payload.type) {
    case 'CONNECTION_REQUEST':
      return {
        body: payload.body ?? '보호자가 연결을 요청했습니다.',
        title: payload.title ?? '연결 요청',
      };
    case 'CONNECTION_ACCEPTED':
      return {
        body: payload.body ?? '피보호자가 연결 요청을 수락했습니다.',
        title: payload.title ?? '연결 수락',
      };
    case 'CONNECTION_REFUSED':
      return {
        body: payload.body ?? '피보호자가 연결 요청을 거절했습니다.',
        title: payload.title ?? '연결 거절',
      };
    case 'CONNECTION_CANCELLED':
      return {
        body: payload.body ?? '연결이 해제되었습니다.',
        title: payload.title ?? '연결 해제',
      };
    case 'SOS_TRIGGERED':
      return {
        body: payload.body ?? `${payload.wardName ?? '피보호자'}${getSubjectParticle(payload.wardName ?? '피보호자')} 긴급 도움을 요청했습니다.`,
        title: payload.title ?? '긴급 SOS',
      };
    case 'MEDICATION_STOPPED':
      return {
        body: payload.body ?? '약을 등록한 보호자가 탈퇴하여 복약 일정이 중지되었습니다. 다시 등록해 주세요.',
        title: payload.title ?? '복약 일정 중지',
      };
    case 'ANOMALY_DETECTED': {
      // BE가 보낸 제목·본문이 우선이고, 없을 때만 BE와 같은 종류별 예비 문구를 쓴다
      const fallback = getAnomalyAlertText({
        role,
        detectedType: payload.detectedType,
        detectedTypeLabel: payload.detectedTypeLabel,
        wardName: payload.wardName,
        location: payload.location,
      });
      return { body: payload.body ?? fallback.body, title: payload.title ?? fallback.title };
    }
    default:
      return {
        body: payload.body ?? '연결 상태가 변경되었습니다.',
        title: payload.title ?? '연결 변경',
      };
  }
}
