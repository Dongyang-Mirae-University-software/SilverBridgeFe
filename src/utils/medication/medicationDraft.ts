// 보호자 "약 추가" 양식(약 목록 × 드시는 시간 목록)의 순수 로직
// - 카메라 인식 결과(OCR)를 양식 초안으로 옮기고, 일괄 등록 요청으로 바꾼다
// - 인식 결과는 언제나 초안이다. 보호자가 확인한 뒤 등록 버튼으로만 저장된다

import { AddMedicationBatchReq, MedicationOcrResponse, MedicationTimeSlot } from '@/service/interface/medication';
import { formatMedicationAlertTime } from '@/utils/format/medication';

// BE 일괄 등록 한도(MedicationBatchCreateRequest)
export const MAX_DRUGS = 20;
export const MAX_TIMES = 6;
export const MAX_NAME_LENGTH = 100;
export const MAX_MEMO_LENGTH = 100;

// 복용량: 0.5 단위, 0.5~99 (BE DoseAmounts와 같은 범위)
export const MIN_DOSE_AMOUNT = 0.5;
export const MAX_DOSE_AMOUNT = 99;
export const DEFAULT_DOSE_AMOUNT = 1;

// 시간대 기본 시각 - BE MedicationTimeSlot.defaultTime과 같다(저녁 18:00)
export const SLOT_DEFAULT_TIME: Record<MedicationTimeSlot, string> = {
  MORNING: '08:00',
  LUNCH: '13:00',
  DINNER: '18:00',
  BEDTIME: '22:00',
};

const SLOT_ORDER: MedicationTimeSlot[] = ['MORNING', 'LUNCH', 'DINNER', 'BEDTIME'];

// 하루 N번만 읽혔을 때의 시간대(시간대 표시가 없는 봉투)
const SLOTS_BY_TIMES_PER_DAY: Record<number, MedicationTimeSlot[]> = {
  1: ['MORNING'],
  2: ['MORNING', 'DINNER'],
  3: ['MORNING', 'LUNCH', 'DINNER'],
  4: ['MORNING', 'LUNCH', 'DINNER', 'BEDTIME'],
};

export interface DraftDrug {
  key: string;
  name: string;
  doseAmount: number;
  lowConfidence: boolean; // 인식 확신이 낮은 약 - 이름 칸을 옅게 강조한다
}

export interface DraftTime {
  key: string;
  time: string; // "HH:mm"
}

export interface MedicationDraft {
  drugs: DraftDrug[];
  times: DraftTime[];
  memo: string;
}

let keySeq = 0;
export function createDraftKey() {
  keySeq += 1;
  return `draft-${keySeq}`;
}

export function createEmptyDrug(): DraftDrug {
  return { key: createDraftKey(), name: '', doseAmount: DEFAULT_DOSE_AMOUNT, lowConfidence: false };
}

export function createEmptyDraft(): MedicationDraft {
  return {
    drugs: [createEmptyDrug()],
    times: [{ key: createDraftKey(), time: SLOT_DEFAULT_TIME.MORNING }],
    memo: '',
  };
}

// 30분 간격 시각 선택지 "00:00" ~ "23:30"
export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, '0');
  const minute = index % 2 === 0 ? '00' : '30';
  return `${hour}:${minute}`;
});

// "08:00" -> "오전 8:00"
export function formatTimeOption(time: string) {
  return formatMedicationAlertTime(time);
}

// "+ 시간 더 넣기": 아직 안 쓴 기본 시각(아침→점심→저녁→자기 전) 먼저, 다 쓰였으면 비어 있는 첫 시각
export function nextUnusedTime(used: string[]) {
  const preferred = SLOT_ORDER.map(slot => SLOT_DEFAULT_TIME[slot]).find(time => !used.includes(time));
  return preferred ?? TIME_OPTIONS.find(time => !used.includes(time)) ?? TIME_OPTIONS[0];
}

// 0.5 단위로 맞추고 범위 안으로 자른다. 읽지 못했거나 이상한 값은 1알
export function normalizeDoseAmount(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return DEFAULT_DOSE_AMOUNT;
  const rounded = Math.round(value * 2) / 2;
  return Math.min(MAX_DOSE_AMOUNT, Math.max(MIN_DOSE_AMOUNT, rounded));
}

// 반알 → 1알 → 2알 … (1.5처럼 OCR이 준 값은 다음 정수로)
export function increaseDose(value: number) {
  const next = value < 1 ? 1 : Math.floor(value) + 1;
  return Math.min(MAX_DOSE_AMOUNT, next);
}

// … 2알 → 1알 → 반알
export function decreaseDose(value: number) {
  const next = value <= 1 ? MIN_DOSE_AMOUNT : Math.ceil(value) - 1;
  return Math.max(MIN_DOSE_AMOUNT, next);
}

// 0.5 → "반알", 2 → "2알", 1.5 → "1알 반"
export function formatDoseLabel(value: number) {
  if (value === 0.5) return '반알';
  const whole = Math.floor(value);
  return value - whole === 0.5 ? `${whole}알 반` : `${whole}알`;
}

// 인식 결과 → 양식 초안. 약이 0개면 null(읽지 못함으로 안내)
export function ocrResultToDraft(result: MedicationOcrResponse | null): MedicationDraft | null {
  if (!result || !result.readable) return null;
  const drugs = result.drugs
    .filter(drug => drug.name && drug.name.trim())
    .slice(0, MAX_DRUGS);
  if (drugs.length === 0) return null;

  const slotSet = new Set(drugs.flatMap(drug => drug.slots ?? []));
  let slots = SLOT_ORDER.filter(slot => slotSet.has(slot));
  if (slots.length === 0) {
    const timesPerDay = Math.max(0, ...drugs.map(drug => drug.timesPerDay ?? 0));
    slots = SLOTS_BY_TIMES_PER_DAY[Math.min(timesPerDay, 4)] ?? ['MORNING'];
  }

  const memo = drugs.map(drug => drug.timing?.trim()).find(Boolean) ?? '';

  return {
    drugs: drugs.map(drug => ({
      key: createDraftKey(),
      name: drug.name.trim().slice(0, MAX_NAME_LENGTH),
      doseAmount: normalizeDoseAmount(drug.perDose),
      lowConfidence: drug.confidence === 'low',
    })),
    times: slots.map(slot => ({ key: createDraftKey(), time: SLOT_DEFAULT_TIME[slot] })),
    memo: memo.slice(0, MAX_MEMO_LENGTH),
  };
}

// 같은 이름(공백 정리·대소문자 무시)이 두 번 이상 있는 약 key 목록 - BE도 400으로 막는다
export function findDuplicateDrugKeys(drugs: DraftDrug[]) {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  drugs.forEach(drug => {
    const normalized = drug.name.trim().toLowerCase();
    if (!normalized) return;
    const first = seen.get(normalized);
    if (first) {
      duplicates.add(first);
      duplicates.add(drug.key);
    } else {
      seen.set(normalized, drug.key);
    }
  });
  return duplicates;
}

export function hasDuplicateTimes(times: DraftTime[]) {
  return new Set(times.map(time => time.time)).size !== times.length;
}

export function canSubmitDraft(draft: MedicationDraft) {
  return (
    draft.drugs.length >= 1 &&
    draft.drugs.length <= MAX_DRUGS &&
    draft.times.length >= 1 &&
    draft.times.length <= MAX_TIMES &&
    draft.drugs.every(drug => drug.name.trim().length > 0) &&
    findDuplicateDrugKeys(draft.drugs).size === 0 &&
    !hasDuplicateTimes(draft.times)
  );
}

// 약 1개면 "등록", 여러 개면 "약 N개 등록"
export function getSubmitLabel(drugCount: number) {
  return drugCount > 1 ? `약 ${drugCount}개 등록` : '등록';
}

export function draftToBatchRequest(draft: MedicationDraft): AddMedicationBatchReq {
  const memo = draft.memo.trim();
  return {
    drugs: draft.drugs.map(drug => ({ name: drug.name.trim(), doseAmount: drug.doseAmount })),
    times: draft.times.map(time => ({ doseTime: `${time.time}:00` })),
    ...(memo ? { memo } : {}),
  };
}
