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
        body: payload.body ?? '연결 요청이 취소되었습니다.',
        title: payload.title ?? '요청 취소',
      };
    default:
      return {
        body: payload.body ?? '연결 상태가 변경되었습니다.',
        title: payload.title ?? '연결 변경',
      };
  }
}
