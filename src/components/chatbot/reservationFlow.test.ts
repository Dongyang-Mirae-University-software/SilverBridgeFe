import { describe, expect, it } from 'vitest';

import type { ChatMessage } from '@/service/interface/chat';
import { isReservationStep, isShowList, isWardNotConnected, selectionText } from './reservationFlow';

const base: ChatMessage = { id: 'a', role: 'assistant', content: '', timestamp: '2026-11-04T00:00:00Z' };
const step = (field: string, intent?: string): ChatMessage => ({
  ...base,
  intent,
  ui: { kind: 'select', field, options: [] },
});

describe('isReservationStep', () => {
  it('예약 단계 칸이면 예약 중', () => {
    for (const field of ['location_sido', 'location', 'location_confirm', 'date', 'time', 'reservation_confirm', 'reservation_edit', 'phone']) {
      expect(isReservationStep(step(field, 'hospital_reservation'))).toBe(true);
    }
    expect(isReservationStep(step('time'))).toBe(true);
  });

  it('진료과 버튼은 예약 의도일 때만 예약 중(진료과 답의 [가까운 ○○ 찾기]는 아님)', () => {
    expect(isReservationStep(step('department', 'medical_advice'))).toBe(false);
    expect(isReservationStep(step('department', 'hospital_reservation'))).toBe(true);
  });

  it('완료 뒤 [예약 목록 보기]·ui 없는 답·답 없음은 예약 중이 아님', () => {
    expect(isReservationStep(step('reservation_followup', 'hospital_reservation'))).toBe(false);
    expect(isReservationStep({ ...base, intent: 'hospital_reservation' })).toBe(false);
    expect(isReservationStep(undefined)).toBe(false);
  });
});

describe('selectionText', () => {
  it('label 이 있으면 label', () => {
    expect(selectionText('show_list', '예약 목록 보기')).toBe('예약 목록 보기');
    expect(selectionText('__type__', ' 직접 입력 ')).toBe('직접 입력');
  });

  it('label 이 없으면 날짜는 읽는 글자로, 코드 값은 "선택했어요"', () => {
    expect(selectionText('2026-11-05')).toBe('11월 5일 (목)');
    expect(selectionText('__more_sido__')).toBe('선택했어요');
    expect(selectionText('show_list')).toBe('선택했어요');
    expect(selectionText('서울')).toBe('서울');
  });
});

describe('isShowList', () => {
  it('reservation_followup 의 show_list 만', () => {
    expect(isShowList('reservation_followup', 'show_list')).toBe(true);
    expect(isShowList('reservation_followup', 'stay')).toBe(false);
    expect(isShowList('other', 'show_list')).toBe(false);
  });
});

describe('isWardNotConnected (2026-11-11 기능 점검 M-1)', () => {
  it('응답 code 가 CHAT_WARD_NOT_CONNECTED 일 때만 참', () => {
    expect(isWardNotConnected({ response: { status: 403, data: { code: 'CHAT_WARD_NOT_CONNECTED' } } })).toBe(true);
    expect(isWardNotConnected({ response: { status: 403, data: { code: 'FORBIDDEN' } } })).toBe(false);
    expect(isWardNotConnected({ response: { status: 403 } })).toBe(false);
    expect(isWardNotConnected(new Error('network'))).toBe(false);
    expect(isWardNotConnected(null)).toBe(false);
    expect(isWardNotConnected(undefined)).toBe(false);
  });
});
