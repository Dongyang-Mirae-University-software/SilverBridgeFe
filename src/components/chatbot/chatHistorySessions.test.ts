import { describe, expect, it } from 'vitest';
import { groupChatSessions, isReservationSession, logToMessages, parseLogTime, userTextOf } from './chatHistorySessions';

describe('상담 기록 대화창 묶기 (2026-11-11)', () => {
  it('sessionId 로 묶고 안은 시간순, 대화창은 최근에 이어진 것부터', () => {
    const sessions = groupChatSessions([
      { id: 5, sessionId: 'b', message: '둘째 대화', createdAt: '2026-11-10T05:00:00Z' },
      { id: 4, sessionId: 'a', message: '셋째 질문', createdAt: '2026-11-11T03:00:00Z' },
      { id: 2, sessionId: 'a', message: '둘째 질문', createdAt: '2026-11-11T02:00:00Z' },
      { id: 1, sessionId: 'a', message: '첫 질문', createdAt: '2026-11-11T01:00:00Z' },
    ]);
    expect(sessions.map(s => s.key)).toEqual(['s:a', 's:b']);
    expect(sessions[0].logs.map(l => l.id)).toEqual([1, 2, 4]);
    expect(sessions[0].title).toBe('첫 질문');
    expect(sessions[0].startedAt).toBe('2026-11-11T01:00:00Z');
  });

  it('sessionId 없는 옛 기록은 한 건씩, 같은 시각은 id 순, 배열이 아니면 빈 목록', () => {
    const sessions = groupChatSessions([
      { id: 2, message: '옛 기록 2' },
      { id: 1, message: '옛 기록 1' },
      { id: 11, sessionId: 'x', message: '뒤', createdAt: '2026-11-11T00:00:00Z' },
      { id: 10, sessionId: 'x', message: '앞', createdAt: '2026-11-11T00:00:00Z' },
    ]);
    expect(sessions).toHaveLength(3);
    expect(sessions.find(s => s.key === 's:x')!.logs.map(l => l.message)).toEqual(['앞', '뒤']);
    expect(groupChatSessions(null)).toEqual([]);
  });

  it('대화창의 상담 대상: 피보호자 ID / 본인 상담 null / 칸이 없으면 undefined (2026-11-11)', () => {
    const sessions = groupChatSessions([
      { id: 3, sessionId: 'w', wardId: 'ward-1', message: 'a' },
      { id: 2, sessionId: 's', wardId: null, message: 'b' },
      { id: 4, sessionId: 'e', wardId: '', message: 'c' },
      { id: 1, sessionId: 'old', message: 'd' },
    ]);
    const of = (key: string) => sessions.find(s => s.key === `s:${key}`)!.wardId;
    expect(of('w')).toBe('ward-1');
    expect(of('s')).toBeNull();
    expect(of('e')).toBeNull();
    expect(of('old')).toBeUndefined();
  });

  it('본인 턴과 피보호자 턴이 섞이면 그 피보호자 + withSelf (선택 칸 제거 뒤 대리 예약, 2026-11-11)', () => {
    const sessions = groupChatSessions([
      { id: 1, sessionId: 'm', wardId: null, message: '병원 예약하고 싶어요', createdAt: '2026-11-11T01:00:00Z' },
      { id: 2, sessionId: 'm', wardId: 'ward-2', message: '[선택] reservation_patient: ward-2', createdAt: '2026-11-11T01:01:00Z' },
      { id: 3, sessionId: 'm', wardId: 'ward-2', message: '서울', createdAt: '2026-11-11T01:02:00Z' },
      { id: 4, sessionId: 'w', wardId: 'ward-1', message: 'a', createdAt: '2026-11-10T01:00:00Z' },
    ]);
    const of = (key: string) => sessions.find(s => s.key === `s:${key}`)!;
    expect(of('m')).toMatchObject({ wardId: 'ward-2', withSelf: true, title: '병원 예약하고 싶어요' });
    expect(of('w')).toMatchObject({ wardId: 'ward-1', withSelf: false });
  });

  it('한 대화창에서 두 피보호자를 예약하면 둘 다 처음 나온 순서로 남긴다 (점검 M-2)', () => {
    const [session] = groupChatSessions([
      { id: 1, sessionId: 'm', wardId: null, message: '병원 예약하고 싶어요', createdAt: '2026-11-11T01:00:00Z' },
      { id: 2, sessionId: 'm', wardId: 'ward-1', message: '서울', createdAt: '2026-11-11T01:01:00Z' },
      { id: 3, sessionId: 'm', wardId: 'ward-2', message: '부산', createdAt: '2026-11-11T01:02:00Z' },
      { id: 4, sessionId: 'm', wardId: 'ward-1', message: '고마워요', createdAt: '2026-11-11T01:03:00Z' },
    ]);
    expect(session).toMatchObject({ wardId: 'ward-1', withSelf: true, wardIds: ['ward-1', 'ward-2'] });
  });

  it('첫 질문이 선택지 턴뿐이면 "선택형 상담"', () => {
    expect(groupChatSessions([{ id: 1, sessionId: 'a', message: '[선택] date: 2026-11-12' }])[0].title).toBe(
      '선택형 상담',
    );
  });

  it('선택지 턴은 고른 값만, ID 값은 "선택했어요"', () => {
    expect(userTextOf('[선택] location: 서울 강남구')).toBe('서울 강남구');
    expect(userTextOf('[선택] reservation_id: 42')).toBe('선택했어요');
    expect(userTextOf('[선택] reservation_followup: show_list')).toBe('선택했어요');
    expect(userTextOf('무릎이 아파요')).toBe('무릎이 아파요');
  });

  it('기록 1건 = 내 질문 + 답. 옛 기록은 layout 없이 reply, 선택지·도구 카드는 싣지 않는다', () => {
    const [q, a] = logToMessages(
      {
        id: '7',
        message: '가슴이 아파요',
        reply: '119에 전화하세요.',
        riskLevel: 'high',
        emergencyWarning: ['119에 전화하세요.'],
        tool: 'search_hospital',
        ui: { kind: 'select', field: 'hospital' },
        createdAt: '2026-11-11T00:00:00Z',
      },
      0,
    );
    expect(q).toMatchObject({ role: 'user', content: '가슴이 아파요' });
    expect(a).toMatchObject({ role: 'assistant', content: '119에 전화하세요.', riskLevel: 'high', layout: null });
    expect(a.emergencyWarning).toEqual(['119에 전화하세요.']);
    expect(a.ui).toBeUndefined();
    expect(a.tool).toBeUndefined();
  });
});

describe('parseLogTime - 기록 시각', () => {
  it('시간대 표시 없는 AI 기록 시각은 UTC로 읽는다 (2026-11-12 gosky 실측: 05:23 = 한국 14:23)', () => {
    expect(parseLogTime('2026-11-12T05:23:39.095242')).toBe(Date.UTC(2026, 10, 12, 5, 23, 39, 95));
  });

  it('Z·+09:00 이 붙어 있으면 그대로 읽는다', () => {
    expect(parseLogTime('2026-11-12T05:23:39Z')).toBe(Date.UTC(2026, 10, 12, 5, 23, 39));
    expect(parseLogTime('2026-11-12T14:23:39+09:00')).toBe(Date.UTC(2026, 10, 12, 5, 23, 39));
  });

  it('없거나 읽을 수 없으면 null', () => {
    expect(parseLogTime(undefined)).toBeNull();
    expect(parseLogTime('')).toBeNull();
    expect(parseLogTime('어제')).toBeNull();
  });
});

describe('isReservationSession - 상담 기록 예약 꼬리표', () => {
  const base = { sessionId: 's', message: '무릎이 아파요' };

  it('intent 가 비어 있어도 예약 칸(ui.field)·예약 도구·예약 칸 선택 기록이 있으면 예약', () => {
    expect(isReservationSession([{ ...base, ui: { kind: 'select', field: 'location_sido' } }])).toBe(true);
    expect(isReservationSession([{ ...base, tool: 'search_hospital' }])).toBe(true);
    expect(isReservationSession([{ ...base, message: '[선택] location: 서울 강남구' }])).toBe(true);
    expect(isReservationSession([{ ...base, intent: 'hospital_reservation' }])).toBe(true);
  });

  it('일반 상담·예약이 아닌 선택(되묻기 답)·진료과 안내만 있으면 상담', () => {
    expect(isReservationSession([base])).toBe(false);
    expect(isReservationSession([{ ...base, message: '[선택] answer: 네' }])).toBe(false);
    // 진료과 답의 [가까운 ○○ 찾기]는 의도가 예약일 때만 예약 단계(reservationFlow 와 같은 기준)
    expect(isReservationSession([{ ...base, intent: 'medical_advice', ui: { kind: 'select', field: 'department' } }])).toBe(false);
  });
});
