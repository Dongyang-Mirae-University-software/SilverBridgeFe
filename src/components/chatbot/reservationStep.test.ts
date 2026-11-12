import { describe, expect, it } from 'vitest';

import { RESERVATION_STEPS, reservationStepIndex } from './reservationStep';

describe('reservationStepIndex', () => {
  it('묻는 칸으로 지금 단계를 정한다', () => {
    expect(reservationStepIndex('department')).toBe(0);
    expect(reservationStepIndex('location_sido')).toBe(1);
    expect(reservationStepIndex('hospital')).toBe(1);
    expect(reservationStepIndex('date')).toBe(2);
    expect(reservationStepIndex('time')).toBe(3);
  });

  it('시간 뒤 확인 단계는 모두 마친 것으로 본다', () => {
    expect(reservationStepIndex('reservation_confirm')).toBe(RESERVATION_STEPS.length);
    expect(reservationStepIndex('patient_name')).toBe(RESERVATION_STEPS.length);
  });

  it('새 예약이 아닌 칸·모르는 칸·빈 값은 단계 표시를 하지 않는다', () => {
    expect(reservationStepIndex('reservation_id')).toBeNull();
    expect(reservationStepIndex('reservation_cancel_confirm')).toBeNull();
    expect(reservationStepIndex('reservation_patient')).toBeNull();
    expect(reservationStepIndex('toString')).toBeNull();
    expect(reservationStepIndex(undefined)).toBeNull();
  });
});
