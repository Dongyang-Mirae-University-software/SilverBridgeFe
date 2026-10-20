import { describe, expect, it } from 'vitest';
import { readReservationConfig } from './reservationConfig';

describe('readReservationConfig', () => {
  it('비밀값이 없으면 null - 코드 기본값으로 동작하지 않는다', () => {
    expect(readReservationConfig({ RESERVATION_API_URL: 'http://reservation-api:6015' })).toBeNull();
    expect(readReservationConfig({ RESERVATION_ACCOUNT_SECRET: '  ', RESERVATION_API_URL: 'http://x' })).toBeNull();
  });

  it('주소가 없으면 null - 공개 도메인으로 대신 붙지 않는다', () => {
    expect(readReservationConfig({ RESERVATION_ACCOUNT_SECRET: 's' })).toBeNull();
  });

  it('둘 다 있으면 /api/v1 주소와 비밀값을 돌려준다', () => {
    expect(readReservationConfig({ RESERVATION_ACCOUNT_SECRET: 's', RESERVATION_API_URL: 'http://reservation-api:6015/' }))
      .toEqual({ apiBase: 'http://reservation-api:6015/api/v1', accountSecret: 's' });
  });
});
