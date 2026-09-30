// 병원 예약 서비스(SilverBridgeReservation) 응답 타입. FE는 /api/reservation/** BFF를 통해 호출한다.
export type HospitalOperationStatus = 'OPEN' | 'CLOSED' | 'BREAK_TIME' | 'HOLIDAY';
export type HospitalCongestionLevel = 'LOW' | 'NORMAL' | 'BUSY' | 'VERY_BUSY';
export type ReservationStatus = 'BOOKED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED';

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
