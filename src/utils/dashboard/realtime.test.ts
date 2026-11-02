import { describe, expect, it } from 'vitest';

import { getRealtimeNotification } from './realtime';

// 화면 안 SOS 알림창 문구 - WS(sos-triggered)는 body 없이 오므로 예비 문구가 실제로 보인다.
// 서버 푸시·OS 알림과 같은 "○○님이 …"여야 한다(2026-11-02, "남궁명진이"로 "님"이 빠졌다)
describe('getRealtimeNotification - SOS', () => {
  it.each([
    ['남궁명진', '남궁명진님이 긴급 도움을 요청했습니다.'],
    ['김영희', '김영희님이 긴급 도움을 요청했습니다.'],
    [undefined, '피보호자님이 긴급 도움을 요청했습니다.'],
    ['', '피보호자님이 긴급 도움을 요청했습니다.'],
  ])('이름 %s → %s', (wardName, body) => {
    expect(getRealtimeNotification({ type: 'SOS_TRIGGERED', wardName } as never)).toEqual({ body, title: '긴급 SOS' });
  });

  it('서버가 준 제목·본문이 있으면 그대로 쓴다', () => {
    expect(
      getRealtimeNotification({ type: 'SOS_TRIGGERED', wardName: '남궁명진', title: '[긴급] 남궁명진님 SOS', body: '계속 요청 중' } as never),
    ).toEqual({ body: '계속 요청 중', title: '[긴급] 남궁명진님 SOS' });
  });
});
