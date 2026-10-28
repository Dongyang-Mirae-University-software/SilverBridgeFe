import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import type { IHospital, IReservationItem } from '@/service/interface/reservation';
import {
  addDays,
  buildDays,
  buildSlotGrid,
  daysBetween,
  findHospitalByName,
  formatDateLong,
  formatDateShort,
  formatSlot,
  formatTime,
  hospitalRows,
  isClosedDay,
  isHospitalOpenNow,
  isSlotPassed,
  kstNowTime,
  kstToday,
  reservationErrorMessage,
  splitReservations,
} from './reservationView';

function reservation(id: number, date: string, time: string, status: IReservationItem['status'] = 'BOOKED') {
  return {
    reservationId: id,
    hospitalName: '강남내과',
    department: '내과',
    reservationDate: date,
    reservationTime: time,
    status,
    symptomSummary: '',
    createdAt: '',
  } satisfies IReservationItem;
}

function hospital(id: number, name: string, departments: string[], extra: Partial<IHospital> = {}): IHospital {
  return {
    id,
    name,
    region: '서울',
    address: `서울 ${name}로 1`,
    phone: '02-000-0000',
    departments,
    operationStatus: 'OPEN',
    congestionLevel: 'LOW',
    bookingAvailable: true,
    description: '',
    openTime: '09:00',
    closeTime: '18:00',
    ...extra,
  };
}

function axiosError(status: number, message = 'server text') {
  const error = new AxiosError(message);
  error.response = { status, data: {}, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
  return error;
}

describe('reservationView', () => {
  it('KST 기준 오늘·지금 - UTC 15시는 KST 다음 날 0시', () => {
    const at = new Date('2026-10-23T15:05:00Z');
    expect(kstToday(at)).toBe('2026-10-24');
    expect(kstNowTime(at)).toBe('00:05');
  });

  it('날짜 표기·더하기·차이', () => {
    expect(formatDateShort('2026-05-11')).toBe('5월 11일 (월)');
    expect(formatDateLong('2026-05-11')).toBe('5월 11일 월요일');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(daysBetween('2026-10-23', '2026-10-25')).toBe(2);
    expect(daysBetween('2026-10-23', '2026-10-23')).toBe(0);
    expect(buildDays('2026-10-23').map(day => `${day.weekday}${day.day}`)).toEqual([
      '금23',
      '토24',
      '일25',
      '월26',
      '화27',
      '수28',
      '목29',
    ]);
  });

  it('시각 표기', () => {
    expect(formatTime('10:00')).toBe('오전 10시');
    expect(formatTime('15:30')).toBe('오후 3시 30분');
    expect(formatTime('12:00')).toBe('오후 12시');
    expect(formatSlot('09:00')).toBe('9:00');
    expect(formatSlot('14:30')).toBe('2:30');
  });

  it('시간 칸 - 진료 시간 30분 단위, 빈 시간에 없으면 마감', () => {
    const grid = buildSlotGrid('09:00', '11:00', ['09:00', '10:30']);
    expect(grid).toEqual([
      { time: '09:00', taken: false },
      { time: '09:30', taken: true },
      { time: '10:00', taken: true },
      { time: '10:30', taken: false },
    ]);
  });

  it('시간 칸 - 점심시간과 겹치는 칸은 그리지 않는다(경계 칸은 남긴다)', () => {
    const grid = buildSlotGrid('11:00', '14:00', ['11:00', '13:30'], { breakStart: '12:30', breakEnd: '13:30' });
    expect(grid.map(slot => slot.time)).toEqual(['11:00', '11:30', '12:00', '13:30']);
    expect(buildSlotGrid('11:00', '12:00', [], { breakStart: null, breakEnd: null })).toHaveLength(2);
  });

  it('휴진 요일 - 날짜 문자열의 요일(0=일)이 closedWeekdays 에 있으면 쉬는 날', () => {
    expect(isClosedDay({ closedWeekdays: [0] }, '2026-10-25')).toBe(true); // 일요일
    expect(isClosedDay({ closedWeekdays: [0] }, '2026-10-26')).toBe(false);
    expect(isClosedDay({ closedWeekdays: [6] }, '2026-10-31')).toBe(true); // 토요일
    expect(isClosedDay({}, '2026-10-25')).toBe(false); // 옛 응답(칸 없음)은 쉬는 날 없음
  });

  it('시간 칸 - 오늘은 지난 시각도 마감', () => {
    const grid = buildSlotGrid('09:00', '10:30', ['09:00', '09:30', '10:00'], { isToday: true, nowTime: '09:30' });
    expect(grid.map(slot => slot.taken)).toEqual([true, true, false]);
  });

  it('다가오는/지난 진료 구분 - 시각이 지난 예약·완료·취소는 지난 진료', () => {
    const items = [
      reservation(1, '2026-10-22', '10:00', 'COMPLETED'),
      reservation(2, '2026-10-23', '09:00'),
      reservation(3, '2026-10-23', '15:00'),
      reservation(4, '2026-10-30', '10:00', 'CONFIRMED'),
      reservation(5, '2026-10-25', '10:00'),
      reservation(6, '2026-10-26', '10:00', 'CANCELED'),
    ];
    const { upcoming, past } = splitReservations(items, '2026-10-23', '12:00');
    expect(upcoming.map(item => item.reservationId)).toEqual([3, 5, 4]);
    expect(past.map(item => item.reservationId)).toEqual([6, 2, 1]);
  });

  it('병원 이름으로 찾기 - 같은 이름이 둘이면 고르지 않는다', () => {
    const list = [hospital(1, '강남내과', ['내과']), hospital(2, '미소치과', ['치과']), hospital(3, '미소치과', ['치과'])];
    expect(findHospitalByName(list, '강남내과')?.id).toBe(1);
    expect(findHospitalByName(list, '미소치과')).toBeNull();
    expect(findHospitalByName(list, '없는병원')).toBeNull();
  });

  it('병원 줄 - 진료과마다 한 줄, 이름·진료과·주소로 찾고 예약 불가 병원은 뺀다', () => {
    const list = [
      hospital(1, '강남내과', ['내과', '가정의학과']),
      hospital(2, '푸른안과', ['안과'], { address: '서울 마포구' }),
      hospital(3, '닫힌의원', ['내과'], { bookingAvailable: false }),
    ];
    expect(hospitalRows(list, '').map(row => `${row.hospital.id}${row.department}`)).toEqual([
      '1내과',
      '1가정의학과',
      '2안과',
    ]);
    expect(hospitalRows(list, '가정').map(row => row.department)).toEqual(['가정의학과']);
    expect(hospitalRows(list, '마포').map(row => row.hospital.id)).toEqual([2]);
  });

  it('상태별 오류 문구', () => {
    expect(reservationErrorMessage(axiosError(401))).toContain('다시 로그인');
    expect(reservationErrorMessage(axiosError(403))).toBe('연결된 피보호자의 예약만 볼 수 있어요.');
    expect(reservationErrorMessage(axiosError(503))).toContain('병원 예약 서비스를 쓸 수 없어요');
    expect(reservationErrorMessage(axiosError(502))).toContain('연결하지 못했어요');
    expect(reservationErrorMessage(axiosError(409, '이미 예약된 시간입니다.'))).toBe('이미 예약된 시간입니다.');
  });
});

describe('reservationView - 점검 반영', () => {
  it('지난 시각 - 어제·오늘 지난 시각·지금 시각은 지남, 오늘 나중·내일은 아님', () => {
    expect(isSlotPassed('2026-10-22', '15:00', '2026-10-23', '12:00')).toBe(true);
    expect(isSlotPassed('2026-10-23', '11:30', '2026-10-23', '12:00')).toBe(true);
    expect(isSlotPassed('2026-10-23', '12:00', '2026-10-23', '12:00')).toBe(true);
    expect(isSlotPassed('2026-10-23', '12:30', '2026-10-23', '12:00')).toBe(false);
    expect(isSlotPassed('2026-10-24', '09:00', '2026-10-23', '23:59')).toBe(false);
  });

  it('지금 예약을 받는 병원은 진료 중(OPEN)일 때만', () => {
    const base = hospital(1, 'a', ['내과']);
    expect(isHospitalOpenNow({ ...base, operationStatus: 'OPEN' })).toBe(true);
    expect(isHospitalOpenNow({ ...base, operationStatus: 'CLOSED' })).toBe(false);
    expect(isHospitalOpenNow({ ...base, operationStatus: 'HOLIDAY' })).toBe(false);
    expect(isHospitalOpenNow({ ...base, operationStatus: 'BREAK_TIME' })).toBe(false);
  });
});
