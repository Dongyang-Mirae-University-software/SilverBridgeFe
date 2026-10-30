// 보호자 병원 예약 화면 전용 도우미. 피보호자 화면과 함께 쓰는 판정은 utils/reservation/reservationView 그대로 쓴다.
import { isAxiosError } from 'axios';

import { IHospital } from '@/service/interface/reservation';
import { reservationErrorMessage } from '@/utils/reservation/reservationView';

// 진료과는 진료과 카드에서 고른다 - 진료과가 하나뿐인 병원은 미리 정해 두고, 여럿이면 빈 값으로 시작한다
export type Pick = { hospital: IHospital; department: string };

// 예약 서비스가 요구하는 형식과 동일
export const PHONE_PATTERN = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
export const SYMPTOM_MAX = 200;

// 병원 한 줄 = 병원 하나(진료과 목록은 줄 안에 보인다). 예약 접수를 멈춘 병원과
// 진료과가 하나도 없는 병원(관리자가 진료과를 모두 지움 - 골라도 시간 칸을 못 묻는다)은 목록에 두지 않는다.
export function searchHospitals(hospitals: IHospital[], query: string) {
  const keyword = query.trim();
  return hospitals
    .filter(hospital => hospital.bookingAvailable && hospital.departments.length > 0)
    .filter(
      hospital =>
        !keyword ||
        hospital.name.includes(keyword) ||
        hospital.departments.some(department => department.includes(keyword)) ||
        hospital.address.includes(keyword),
    );
}

// "내과 · 가정의학과 · 정형외과 외 2개"
export function departmentSummary(departments: string[]) {
  const shown = departments.slice(0, 3).join(' · ');
  return departments.length > 3 ? `${shown} 외 ${departments.length - 3}개` : shown;
}

export function pickOf(hospital: IHospital, department?: string): Pick {
  return { hospital, department: department ?? (hospital.departments.length === 1 ? hospital.departments[0] : '') };
}

// 다음 진료까지 남은 날 - "오늘" / "내일" / "3일 뒤"
export function ddayLabel(days: number) {
  if (days <= 0) return '오늘';
  if (days === 1) return '내일';
  return `${days}일 뒤`;
}

// 입력하는 대로 "010-1234-5678" 꼴로 줄표를 넣는다
export function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  const middle = digits.length === 11 ? 4 : 3;
  return `${digits.slice(0, 3)}-${digits.slice(3, 3 + middle)}-${digits.slice(3 + middle)}`;
}

// 같은 사람·같은 시간의 예약은 예약 서비스가 막는다(DUPLICATE_RESERVATION) - 누구의 예약인지 넣어 안내한다
export function createErrorMessage(error: unknown, wardName: string) {
  const code = isAxiosError<{ code?: string }>(error) ? error.response?.data?.code : undefined;
  if (code === 'DUPLICATE_RESERVATION') {
    return `${wardName} 님은 이 시간에 이미 예약이 있어요. 예약 현황을 확인하거나 다른 시간을 골라 주세요.`;
  }
  return reservationErrorMessage(error);
}
