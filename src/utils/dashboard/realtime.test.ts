import { describe, expect, it } from 'vitest';

import { getRealtimeNotification } from './realtime';

// 화면 안 SOS 알림창 예비 문구 - BE가 WS(sos-triggered)에 title·body를 싣지 않을 때만 보인다(BE #433부터는 싣는다).
// 서버 푸시·OS 알림과 같은 "[긴급] ○○님 SOS" / "○○님이 …"여야 한다(2026-11-02)
describe('getRealtimeNotification - SOS', () => {
  it.each([
    ['남궁명진', '남궁명진님이 긴급 도움을 요청했습니다.', '[긴급] 남궁명진님 SOS'],
    ['김영희', '김영희님이 긴급 도움을 요청했습니다.', '[긴급] 김영희님 SOS'],
    [undefined, '피보호자님이 긴급 도움을 요청했습니다.', '[긴급] 피보호자님 SOS'],
    ['', '피보호자님이 긴급 도움을 요청했습니다.', '[긴급] 피보호자님 SOS'],
  ])('이름 %s → %s', (wardName, body, title) => {
    expect(getRealtimeNotification({ type: 'SOS_TRIGGERED', wardName } as never)).toEqual({ body, title });
  });

  it('BE가 실은 제목·본문(반복 SOS 두 줄 포함)을 그대로 쓴다', () => {
    const payload = {
      type: 'SOS_TRIGGERED',
      wardName: '김영희',
      title: '[긴급] 김영희님 SOS',
      body: '김영희님이 계속 도움을 요청하고 있습니다.\n최근 10분 내 2번째 요청입니다.',
    };
    expect(getRealtimeNotification(payload as never)).toEqual({ body: payload.body, title: payload.title });
  });

  it('서버가 준 제목·본문이 있으면 그대로 쓴다', () => {
    expect(
      getRealtimeNotification({ type: 'SOS_TRIGGERED', wardName: '남궁명진', title: '[긴급] 남궁명진님 SOS', body: '계속 요청 중' } as never),
    ).toEqual({ body: '계속 요청 중', title: '[긴급] 남궁명진님 SOS' });
  });
});
