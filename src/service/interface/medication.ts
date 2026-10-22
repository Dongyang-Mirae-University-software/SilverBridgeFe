// 복약 관리 공통 타입 (보호자·피보호자 양쪽에서 공유)
// Swagger 그룹: "보호자 - 복약", "피보호자 - 복약"

export type MedicationTimeSlot = 'MORNING' | 'LUNCH' | 'DINNER' | 'BEDTIME';

export interface MedicationItem {
  medicationId: number;
  name: string;
  timeSlot: MedicationTimeSlot;
  doseTime: string; // "08:00:00"
  doseAmount: number;
  memo: string | null;
  taken: boolean; // 오늘 체크 여부
  takenAt: string | null; // ISO 8601 (+09:00)
}

// 보호자: GET /api/guardian/medication 응답의 피보호자별 카드 1건
export interface WardMedicationSummary {
  wardId: string;
  wardName: string | null;
  age: number | null; // 만 나이. 생년월일 미등록이면 null
  alarmEnabled: boolean; // 피보호자에게 보낼 복용 알림 (보호자들이 공유)
  remindAgainEnabled: boolean; // 15분 뒤 재알림 (보호자들이 공유)
  missedAlertEnabled: boolean; // 내가 이 피보호자 건 요약을 받을지 (나만의 값)
  missedAlertTime: string; // "22:30:00" — 받을 시각 = 집계 상한 (나만의 값)
  doseDate: string; // "2026-08-06" (KST)
  takenCount: number;
  totalCount: number;
  medications: MedicationItem[];
}

// 피보호자: GET /api/ward/medication/today
export interface TodayMedicationResponse {
  doseDate: string;
  takenCount: number;
  totalCount: number;
  medications: MedicationItem[];
}

// 보호자: POST /api/guardian/ward/{wardId}/medication
export interface AddMedicationReq {
  name: string;
  timeSlot: MedicationTimeSlot;
  doseTime?: string;
  doseAmount?: number;
  memo?: string;
}

// 보호자: PATCH /api/guardian/medication/{medicationId} — 보낸 필드만 갱신(부분 수정)
export interface UpdateMedicationReq {
  name?: string;
  timeSlot?: MedicationTimeSlot;
  doseTime?: string;
  doseAmount?: number;
  memo?: string;
}

// GET|PUT /api/guardian/ward/{wardId}/medication-setting — 피보호자 단위(공유) 설정
export interface MedicationSettingResponse {
  wardId: string;
  alarmEnabled: boolean;
  remindAgainEnabled: boolean;
}

export interface UpdateMedicationSettingReq {
  alarmEnabled?: boolean;
  remindAgainEnabled?: boolean;
}

// GET|PUT /api/guardian/ward/{wardId}/medication-alert-setting — (보호자, 피보호자) 단위 설정
export interface GuardianMedicationAlertSetting {
  wardId: string;
  missedAlertEnabled: boolean;
  missedAlertTime: string; // 응답은 항상 실효 시각(미설정이면 기본 "21:00:00")
}

export interface UpdateMedicationAlertSettingReq {
  missedAlertEnabled?: boolean;
  missedAlertTime?: string;
}

// 보호자: POST /api/guardian/ward/{wardId}/medication/batch — drugs × times 만큼 등록, 전부 성공 또는 전부 실패
// 시간대(timeSlot)는 서버가 시각으로 정한다(04~10 아침 / 11~15 점심 / 16~20 저녁 / 그 외 취침 전)
export interface AddMedicationBatchReq {
  drugs: { name: string; doseAmount?: number }[]; // 1~20개, 같은 이름 중복 불가. doseAmount는 0.5 단위(반 알 = 0.5)
  times: { doseTime: string }[]; // 1~6개, "HH:mm:ss", 같은 시각 중복 불가
  memo?: string;
}

// 보호자: POST /api/guardian/ward/{wardId}/medication/ocr — 약 봉투 사진 인식 결과(등록 초안, 서버에 저장되지 않음)
export interface MedicationOcrDrug {
  name: string;
  perDose: number | null; // 1회 복용량(정), 반 알은 0.5
  timesPerDay: number | null;
  days: number | null;
  slots: MedicationTimeSlot[]; // 봉투에 표시된 시간대. 없으면 빈 배열
  timing: string | null; // 예) 식후 30분
  confidence: 'high' | 'low' | null; // 화면 강조용. high라도 보호자 확인은 필요
}

export interface MedicationOcrResponse {
  readable: boolean; // false면 drugs는 빈 배열
  drugs: MedicationOcrDrug[];
}
