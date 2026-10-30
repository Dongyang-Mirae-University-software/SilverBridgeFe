// 병원 예약 화면(보호자 예약하기·피보호자 예약 현황) 공용 계산. 날짜·시각은 모두 KST 기준이다.
import { isAxiosError } from 'axios';

import type { IHospital, IReservationItem } from '@/service/interface/reservation';

const WEEKDAYS = '일월화수목금토';
const ACTIVE_STATUS: IReservationItem['status'][] = ['BOOKED', 'CONFIRMED'];

const kstDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const kstTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function kstToday(now: Date = new Date()) {
  return kstDate.format(now);
}

export function kstNowTime(now: Date = new Date()) {
  return kstTime.format(now);
}

function parseIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
}

export function addDays(iso: string, days: number) {
  const { y, m, d } = parseIso(iso);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  const a = parseIso(fromIso);
  const b = parseIso(toIso);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

// "5월 11일 (월)" - 보호자 화면
export function formatDateShort(iso: string) {
  const { m, d, weekday } = parseIso(iso);
  return `${m}월 ${d}일 (${weekday})`;
}

// "5월 11일 월요일" - 피보호자 화면
export function formatDateLong(iso: string) {
  const { m, d, weekday } = parseIso(iso);
  return `${m}월 ${d}일 ${weekday}요일`;
}

// "오전 10시", "오후 3시 30분"
export function formatTime(time: string) {
  const [h, min] = time.split(':').map(Number);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${min ? ` ${min}분` : ''}`;
}

// 시간 버튼 글씨 "9:00", "2:30"
export function formatSlot(time: string) {
  const [h, min] = time.split(':');
  return `${Number(h) % 12 || 12}:${min}`;
}

export interface DayCell {
  iso: string;
  day: number;
  weekday: string;
}

export function buildDays(today: string, count = 7): DayCell[] {
  return Array.from({ length: count }, (_, i) => {
    const iso = addDays(today, i);
    const { d, weekday } = parseIso(iso);
    return { iso, day: d, weekday };
  });
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function toTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export interface SlotCell {
  time: string;
  taken: boolean;
}

// 예약 서비스와 같은 규칙(진료 시작부터 30분 단위, 끝나기 30분 전까지)으로 전체 칸을 만들고,
// 빈 시간 목록에 없는 칸을 "마감"으로 둔다. 오늘은 지난 시각도 마감이다.
// 점심시간과 겹치는 칸은 아예 그리지 않는다(예약 서비스도 그 칸을 빈 시간에서 뺀다).
export function buildSlotGrid(
  openTime: string,
  closeTime: string,
  available: string[],
  options: { isToday?: boolean; nowTime?: string; breakStart?: string | null; breakEnd?: string | null } = {},
): SlotCell[] {
  const times = new Set(available);
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  // 점심시간이 그날 진료 시간 안에 다 들지 않으면 그날은 점심이 없다(예: 토요일 09:00~13:00 반일) - 예약 서비스와 같은 규칙
  const breakInside =
    Boolean(options.breakStart && options.breakEnd) &&
    options.breakStart! >= openTime &&
    options.breakEnd! <= closeTime;
  const breakStart = breakInside ? toMinutes(options.breakStart!) : NaN;
  const breakEnd = breakInside ? toMinutes(options.breakEnd!) : NaN;
  const inBreak = (t: number) =>
    !Number.isNaN(breakStart) && !Number.isNaN(breakEnd) && t < breakEnd && t + 30 > breakStart;
  if (!Number.isNaN(open) && !Number.isNaN(close)) {
    for (let t = open; t + 30 <= close; t += 30) if (!inBreak(t)) times.add(toTime(t));
  }
  const free = new Set(available);
  return [...times].sort().map(time => ({
    time,
    taken: !free.has(time) || Boolean(options.isToday && options.nowTime && time <= options.nowTime),
  }));
}

function weekdayOf(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// 그 병원이 쉬는 요일인가(closedWeekdays, 0=일 … 6=토). 날짜 문자열 기준이라 시간대와 무관하다.
export function isClosedDay(hospital: Pick<IHospital, 'closedWeekdays'>, iso: string) {
  return (hospital.closedWeekdays ?? []).includes(weekdayOf(iso));
}

// 그날의 진료 시간 - 그 요일 값(weekdayHours)이 있으면 그것, 없으면 기본 진료 시간.
export function hoursForDay(hospital: Pick<IHospital, 'openTime' | 'closeTime' | 'weekdayHours'>, iso: string) {
  const day = (hospital.weekdayHours ?? []).find(h => h.weekday === weekdayOf(iso));
  return day
    ? { openTime: day.openTime, closeTime: day.closeTime }
    : { openTime: hospital.openTime, closeTime: hospital.closeTime };
}

// 고른 날짜·시각이 이미 지났는가(KST). 오늘은 지금 시각과 같아도 지난 것으로 본다.
export function isSlotPassed(date: string, time: string, today: string, nowTime: string) {
  return date < today || (date === today && time <= nowTime);
}

// 지금은 예약을 받지 않는 병원(진료 종료·휴게·휴진). 예약 서비스가 지금 상태로 거절한다.
export function isHospitalOpenNow(hospital: IHospital) {
  return hospital.operationStatus === 'OPEN';
}

// 지난 예약의 상태 표시(보호자·피보호자 화면 공용). 진료를 마친 예약(COMPLETED)과 날짜만 지난 예약은 따로 적지 않는다.
const PAST_STATUS_LABEL: Partial<Record<IReservationItem['status'], string>> = {
  CANCELED: '취소됨',
  NO_SHOW: '방문하지 않음',
  REJECTED: '병원이 거절함',
};

export function pastStatusLabel(status: IReservationItem['status']) {
  return PAST_STATUS_LABEL[status] ?? null;
}

export function isActiveReservation(item: IReservationItem) {
  return ACTIVE_STATUS.includes(item.status);
}

const byDateTime = (a: IReservationItem, b: IReservationItem) =>
  `${a.reservationDate} ${a.reservationTime}`.localeCompare(`${b.reservationDate} ${b.reservationTime}`);

// 다가오는 진료 = 아직 시각이 지나지 않은 예약(예약됨·확정), 가까운 순.
// 지난 진료 = 나머지(시각이 지난 예약·진료 완료·취소됨), 최근 순.
export function splitReservations(items: IReservationItem[], today: string, nowTime: string) {
  const isUpcoming = (item: IReservationItem) =>
    isActiveReservation(item) &&
    (item.reservationDate > today || (item.reservationDate === today && item.reservationTime >= nowTime));
  const upcoming = items.filter(isUpcoming).sort(byDateTime);
  const past = items.filter(item => !isUpcoming(item)).sort((a, b) => byDateTime(b, a));
  return { upcoming, past };
}

// 예약 응답에는 병원 ID·주소가 없어 이름으로 찾는다. 같은 이름이 둘 이상이면 고르지 않는다.
export function findHospitalByName(hospitals: IHospital[], name: string) {
  const matches = hospitals.filter(item => item.name === name);
  return matches.length === 1 ? matches[0] : null;
}

export interface HospitalRow {
  hospital: IHospital;
  department: string;
}

// 병원 한 줄 = "병원 · 진료과". 진료과가 여럿이면 줄을 나눠 고르는 순간 진료과도 정해진다.
export function hospitalRows(hospitals: IHospital[], query: string): HospitalRow[] {
  const keyword = query.trim();
  return hospitals
    .filter(hospital => hospital.bookingAvailable)
    .flatMap(hospital => hospital.departments.map(department => ({ hospital, department })))
    .filter(
      ({ hospital, department }) =>
        !keyword ||
        hospital.name.includes(keyword) ||
        department.includes(keyword) ||
        hospital.address.includes(keyword),
    );
}

function statusOf(error: unknown) {
  if (isAxiosError(error)) return error.response?.status ?? error.status;
  return undefined;
}

// 상태별로 다른 안내. 그 밖의 업무 오류(이미 찬 시간 등)는 서버 문구를 그대로 쓴다.
export function reservationErrorMessage(error: unknown) {
  switch (statusOf(error)) {
    case 401:
      return '로그인이 끝났어요. 다시 로그인해 주세요.';
    case 403:
      return '연결된 피보호자의 예약만 볼 수 있어요.';
    case 503:
      return '지금은 병원 예약 서비스를 쓸 수 없어요. 잠시 뒤 다시 시도해 주세요.';
    case 502:
      return '예약 서비스에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    default:
      return error instanceof Error && error.message ? error.message : '요청을 처리하지 못했어요.';
  }
}
