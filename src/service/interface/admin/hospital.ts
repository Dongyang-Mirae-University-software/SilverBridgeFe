export type AdminHospitalOperationStatus = 'OPEN' | 'CLOSED' | 'BREAK_TIME' | 'HOLIDAY' | 'INSPECTION';
export type AdminHospitalCongestionLevel = 'LOW' | 'NORMAL' | 'BUSY' | 'VERY_BUSY';

export interface AdminHospitalDepartment {
  id: number;
  name: string | null;
}

export interface AdminHospitalWeekdayHours {
  weekday: number;
  openTime: string;
  closeTime: string;
}

export interface AdminHospitalStatus {
  operationStatus: AdminHospitalOperationStatus | null;
  congestionLevel: AdminHospitalCongestionLevel | null;
  waitingCount: number | null;
  averageWaitingMinutes: number | null;
  todayReservationCount: number | null;
  acceptingPatients: boolean | null;
  notice: string | null;
  updatedAt: string | null;
}

export interface AdminHospitalItem {
  id: number;
  name: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
  description: string;
  openTime: string | null;
  closeTime: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  closedWeekdays?: number[];
  weekdayHours?: AdminHospitalWeekdayHours[];
  bookingAvailable: boolean;
  departments: AdminHospitalDepartment[];
  status: AdminHospitalStatus | null;
  registeredAt: string | null;
  updatedAt: string | null;
}

export interface AdminHospitalPage {
  content: AdminHospitalItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AdminHospitalSummary {
  total: number;
  bookingAvailable: number;
  latestRegisteredAt: string | null;
}

export interface AdminHospitalListParams {
  q?: string;
  region?: string;
  department?: string;
  page: number;
  size: number;
}

export interface AdminHospitalCreateRequest {
  name: string;
  region: string;
  address: string;
  phone: string;
  description?: string;
  openTime: string;
  closeTime: string;
  bookingAvailable?: boolean;
  departments: string[];
  breakStart?: string;
  breakEnd?: string;
  closedWeekdays?: number[];
  weekdayHours?: AdminHospitalWeekdayHours[];
}

export type AdminHospitalUpdateRequest = Partial<Omit<AdminHospitalCreateRequest, 'departments' | 'breakStart' | 'breakEnd' | 'closedWeekdays' | 'weekdayHours'>> & {
  breakStart?: string;
  breakEnd?: string;
  closedWeekdays?: number[];
  weekdayHours?: AdminHospitalWeekdayHours[];
};

export interface AdminHospitalStatusUpdateRequest {
  operationStatus?: AdminHospitalOperationStatus;
  congestionLevel?: AdminHospitalCongestionLevel;
  waitingCount?: number;
  averageWaitingMinutes?: number;
  acceptingPatients?: boolean;
  notice?: string;
}
