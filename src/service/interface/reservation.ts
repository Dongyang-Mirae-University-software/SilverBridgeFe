// 병원 예약 서비스(SilverBridgeReservation) 응답 타입. FE는 /api/reservation/** BFF를 통해 호출한다.
// 값 목록은 예약 서비스 prisma/schema.prisma 의 enum 그대로
export type HospitalOperationStatus = 'OPEN' | 'CLOSED' | 'BREAK_TIME' | 'HOLIDAY' | 'INSPECTION';
export type HospitalCongestionLevel = 'LOW' | 'NORMAL' | 'BUSY' | 'VERY_BUSY';
export type ReservationStatus = 'BOOKED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED' | 'NO_SHOW' | 'REJECTED';

export interface IHospital {
  id: number;
  name: string;
  region: string;
  address: string;
  phone: string;
  departments: string[];
  operationStatus: HospitalOperationStatus;
  congestionLevel: HospitalCongestionLevel;
  bookingAvailable: boolean;
  description: string;
  openTime: string;
  closeTime: string;
  // 점심시간(HH:mm, 없으면 null)·휴진 요일(0=일 … 6=토). 예약 서비스 2026-10-28 이전 응답에는 없다
  breakStart?: string | null;
  breakEnd?: string | null;
  closedWeekdays?: number[];
  // 요일별 진료 시간(그 요일만 기본 진료 시간을 덮어씀, 예: 토요일 반일)
  weekdayHours?: { weekday: number; openTime: string; closeTime: string }[];
}

export interface IAvailableSlots {
  hospitalId: number;
  date: string;
  availableSlots: string[];
}

export interface IReservationCreateReq {
  hospitalId: number;
  department: string;
  reservationDate: string; // YYYY-MM-DD
  reservationTime: string; // HH:mm
  patientName: string;
  phone: string;
  birthDate?: string;
  symptomSummary?: string;
  guardianName?: string;
  guardianPhone?: string;
}

export interface IReservationItem {
  reservationId: number;
  hospitalName: string;
  department: string;
  reservationDate: string;
  reservationTime: string;
  status: ReservationStatus;
  symptomSummary: string;
  createdAt: string;
}
