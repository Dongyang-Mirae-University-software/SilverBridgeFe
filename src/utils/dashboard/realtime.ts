import { ConnectionRealtimePayload } from '@/lib/realtime/connectionSocket';

export function getRealtimeNotification(payload: ConnectionRealtimePayload) {
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
        body: payload.body ?? `${payload.wardName ?? '피보호자'}님이 긴급 도움을 요청했습니다.`,
        title: payload.title ?? '긴급 SOS',
      };
    default:
      return {
        body: payload.body ?? '연결 상태가 변경되었습니다.',
        title: payload.title ?? '연결 변경',
      };
  }
}
