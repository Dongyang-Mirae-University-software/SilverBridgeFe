// 보호자 "약 추가"(1/2 약 → 2/2 언제 드세요?)의 순수 로직
// - 카메라 인식 결과(OCR)를 약 목록 초안으로 옮기고, 고른 시간으로 일괄 등록 요청을 만든다
// - 인식 결과는 언제나 초안이다. 보호자가 확인한 뒤 등록 버튼으로만 저장된다

import axios from 'axios';

import { AddMedicationBatchReq, MedicationOcrResponse, MedicationTimeSlot } from '@/service/interface/medication';

// BE 일괄 등록 한도(MedicationBatchCreateRequest)
export const MAX_DRUGS = 20;
export const MAX_NAME_LENGTH = 100;

// 복용량: 0.5 단위, 0.5~99 (BE DoseAmounts와 같은 범위)
export const MIN_DOSE_AMOUNT = 0.5;
export const MAX_DOSE_AMOUNT = 99;
export const DEFAULT_DOSE_AMOUNT = 1;

export const SLOT_ORDER: MedicationTimeSlot[] = ['MORNING', 'LUNCH', 'DINNER', 'BEDTIME'];

// "언제 드세요?" 선택 칩. 시각은 BE MedicationTimeSlot.fromDoseTime이 같은 시간대로 받는 값이다
// (04~10시 아침 / 11~15시 점심 / 16~20시 저녁 / 그 외 취침 전)
export const DOSE_CHIPS: Record<MedicationTimeSlot, { label: string; timeLabel: string; time: string }> = {
  MORNING: { label: '아침', timeLabel: '오전 8시', time: '08:00' },
  LUNCH: { label: '점심', timeLabel: '낮 12시', time: '12:00' },
  DINNER: { label: '저녁', timeLabel: '오후 7시', time: '19:00' },
  BEDTIME: { label: '자기 전', timeLabel: '오후 9시', time: '21:00' },
};

// 하루 N번만 알 때의 기본 선택(시간대 표시가 없는 봉투). 4번 이상은 네 칸 모두
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
  timesPerDay: number | null; // 봉투에 적힌 하루 횟수. 모르면(직접 쓴 약 포함) null
  slots: MedicationTimeSlot[]; // 봉투에 표시된 시간대. 없으면 빈 배열
}

let keySeq = 0;
export function createDraftKey() {
  keySeq += 1;
  return `draft-${keySeq}`;
}

export function createEmptyDrug(): DraftDrug {
  return {
    key: createDraftKey(),
    name: '',
    doseAmount: DEFAULT_DOSE_AMOUNT,
    lowConfidence: false,
    timesPerDay: null,
    slots: [],
  };
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

// 하루 횟수: 1 이상의 정수만 아는 값으로 본다
function knownTimesPerDay(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isInteger(value) && value >= 1 ? value : null;
}

function orderSlots(slots: Iterable<MedicationTimeSlot>) {
  const set = new Set(slots);
  return SLOT_ORDER.filter(slot => set.has(slot));
}

export interface OcrDraftResult {
  drugs: DraftDrug[];
  truncated: boolean; // 약이 MAX_DRUGS개를 넘어 앞의 것만 가져왔다
}

// 인식 결과 → 약 목록 초안. 약이 0개면 null(읽지 못함으로 안내)
export function ocrResultToDraft(result: MedicationOcrResponse | null): OcrDraftResult | null {
  if (!result || !result.readable) return null;
  const named = result.drugs.filter(drug => drug.name && drug.name.trim());
  if (named.length === 0) return null;

  return {
    drugs: named.slice(0, MAX_DRUGS).map(drug => ({
      key: createDraftKey(),
      name: drug.name.trim().slice(0, MAX_NAME_LENGTH),
      doseAmount: normalizeDoseAmount(drug.perDose),
      lowConfidence: drug.confidence === 'low',
      timesPerDay: knownTimesPerDay(drug.timesPerDay),
      slots: orderSlots(drug.slots ?? []),
    })),
    truncated: named.length > MAX_DRUGS,
  };
}

// BE 중복 판정(TextSanitizer.sanitize + 소문자)과 같은 기준: NFC → 제어·서식 문자 제거 → 공백 묶기 → trim → 소문자
export function normalizeDrugName(name: string) {
  return name
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

// 같은 이름(공백·보이지 않는 문자 정리, 대소문자 무시)이 두 번 이상 있는 약 key 목록 - BE도 400으로 막는다
export function findDuplicateDrugKeys(drugs: DraftDrug[]) {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  drugs.forEach(drug => {
    const normalized = normalizeDrugName(drug.name);
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

// 1/2 → 2/2: 약 1~20개, 이름이 모두 있고 겹치지 않아야 한다
export function canProceedDrugs(drugs: DraftDrug[]) {
  return (
    drugs.length >= 1 &&
    drugs.length <= MAX_DRUGS &&
    drugs.every(drug => normalizeDrugName(drug.name).length > 0) &&
    findDuplicateDrugKeys(drugs).size === 0
  );
}

// 2/2 "언제 드세요?" - 모든 약이 같은 시간을 쓴다(일괄 등록 1번)
// 하루 횟수별로 줄을 나누던 화면(FE #86)은 고르기가 어려워 통합했다(2026-10-22 사용자 결정) - 횟수가 다른 약은 안내만 한다
export interface DoseGroup {
  timesPerDay: number | null; // 약들의 하루 횟수가 모두 같을 때 그 값. 다르거나 모르면 null
  drugs: DraftDrug[];
}

function knownCounts(drugs: DraftDrug[]) {
  return drugs.map(drug => drug.timesPerDay).filter((n): n is number => n !== null);
}

export function toDoseGroup(drugs: DraftDrug[]): DoseGroup {
  const known = [...new Set(knownCounts(drugs))];
  return { timesPerDay: known.length === 1 ? known[0] : null, drugs };
}

// 약마다 봉투의 하루 횟수가 다르면 한 줄로 알린다(막지 않는다) - 모두 같은 시간으로 등록되므로 과다 복용 안내를 알아차리게
// 가장 많은 약의 횟수(같으면 큰 쪽)와 다른 약만 적는다: "코싹엘정 하루 2번 - 다른 약과 하루 횟수가 달라요. …"
export function getMixedTimesNote(drugs: DraftDrug[]) {
  const counts = knownCounts(drugs);
  if (new Set(counts).size <= 1) return null;
  const tally = new Map<number, number>();
  counts.forEach(n => tally.set(n, (tally.get(n) ?? 0) + 1));
  const common = [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const differing = drugs.filter(drug => drug.timesPerDay !== null && drug.timesPerDay !== common);
  const parts = [...new Set(differing.map(drug => drug.timesPerDay as number))].sort((a, b) => b - a).map(n => {
    const named = differing.filter(drug => drug.timesPerDay === n);
    const rest = named.length > 1 ? ` 외 ${named.length - 1}개` : '';
    return `${named[0].name.trim()}${rest} 하루 ${n}번`;
  });
  const base = `${parts.join(', ')} - 다른 약과 하루 횟수가 달라요. 다르게 드시는 약은 등록 후 시간을 고쳐 주세요`;
  // 가장 많은 약의 횟수가 칩 수(4)보다 많으면 그 사실도 알린다
  return common > SLOT_ORDER.length ? `${base}. 여기서는 ${SLOT_ORDER.length}번까지 고를 수 있어요` : base;
}

// 기본 선택: 봉투 시간대 표시가 있고 그 개수가 약들의 하루 횟수와 같으면(횟수가 섞였거나 모르면 표시만으로) 그대로,
// 아니면 하루 횟수로(1 아침 / 2 아침·저녁 / 3 아침·점심·저녁 / 4 이상 네 칸, 섞였으면 가장 큰 횟수), 정보가 없으면 아침
export function defaultSlotsForGroup(group: DoseGroup): MedicationTimeSlot[] {
  const marked = orderSlots(group.drugs.flatMap(drug => drug.slots));
  if (marked.length > 0 && (group.timesPerDay === null || marked.length === group.timesPerDay)) return marked;
  const count = group.timesPerDay ?? Math.max(0, ...knownCounts(group.drugs));
  if (count < 1) return ['MORNING'];
  return SLOTS_BY_TIMES_PER_DAY[Math.min(count, 4)];
}

// 고른 칸 수가 봉투의 하루 횟수와 다르면 알린다(막지는 않는다). 칩은 4개라 5번 이상은 그 사실도 알린다
export function getTimesMismatchHint(group: DoseGroup, selected: MedicationTimeSlot[]) {
  if (group.timesPerDay === null || selected.length === group.timesPerDay) return null;
  // 직접 넣은 약(횟수 모름)이 섞여 있으면 봉투에 적힌 약에만 해당한다는 것을 밝힌다
  const hasUnknown = group.drugs.some(drug => drug.timesPerDay === null);
  const base = `${hasUnknown ? '봉투에 적힌 약은' : '봉투에는'} 하루 ${group.timesPerDay}번이에요`;
  return group.timesPerDay > SLOT_ORDER.length ? `${base}. 여기서는 ${SLOT_ORDER.length}번까지 고를 수 있어요` : base;
}

export function toggleSlot(selected: MedicationTimeSlot[], slot: MedicationTimeSlot) {
  return selected.includes(slot) ? selected.filter(item => item !== slot) : orderSlots([...selected, slot]);
}

// 등록 실패가 "결과를 모르는" 실패인지 - 서버에 이미 등록됐을 수 있어 다시 보내면 중복 등록된다(BE는 다른 요청의 같은 이름을 막지 않는다)
// 응답 없음(시간 초과·네트워크) / 408 / 5xx(FE 중계가 BE 응답 전에 끊긴 500, 앞단 nginx 504 등)
// 4xx는 BE가 처리 전에 거절한 것(검증 400·인가 403 - 일괄 등록은 한 트랜잭션)이라 고쳐서 다시 등록할 수 있다
export function isUncertainFailure(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 408 || status >= 500;
}

export function groupToBatchRequest(group: DoseGroup, selected: MedicationTimeSlot[]): AddMedicationBatchReq {
  return {
    drugs: group.drugs.map(drug => ({ name: drug.name.trim(), doseAmount: drug.doseAmount })),
    times: orderSlots(selected).map(slot => ({ doseTime: `${DOSE_CHIPS[slot].time}:00` })),
  };
}
