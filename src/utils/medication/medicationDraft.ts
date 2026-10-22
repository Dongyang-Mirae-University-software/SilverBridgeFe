// 보호자 "약 추가"(1/2 약 → 2/2 언제 드세요?)의 순수 로직
// - 카메라 인식 결과(OCR)를 약 목록 초안으로 옮기고, 하루 횟수별 줄마다 일괄 등록 요청으로 바꾼다
// - 인식 결과는 언제나 초안이다. 보호자가 확인한 뒤 등록 버튼으로만 저장된다

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
// (줄을 나눠 따로 보내도 같은 이름이 두 번 등록되지 않게 줄이 아니라 전체에서 본다)
export function canProceedDrugs(drugs: DraftDrug[]) {
  return (
    drugs.length >= 1 &&
    drugs.length <= MAX_DRUGS &&
    drugs.every(drug => normalizeDrugName(drug.name).length > 0) &&
    findDuplicateDrugKeys(drugs).size === 0
  );
}

// 2/2의 칩 줄 1개 = 일괄 등록 1번
export interface DoseGroup {
  key: string;
  timesPerDay: number | null; // 이 줄 약들의 하루 횟수. 모르면 null
  drugs: DraftDrug[];
}

export const SINGLE_GROUP_KEY = 'all';
const UNKNOWN_GROUP_KEY = 'unknown';

// 약들의 하루 횟수가 모두 같거나 모르면 한 줄. 서로 다르면 횟수별로 나눈다(많은 횟수 먼저)
// 하루 2번 약을 3번 줄에 섞으면 과다 복용 안내가 된다(2026-10-22 실제 봉투 시험)
// 줄을 나눌 때 횟수를 모르는 약은 다른 줄에 섞지 않고 "하루 횟수 모름" 줄로 따로 둔다
export function groupDrugsByTimesPerDay(drugs: DraftDrug[]): DoseGroup[] {
  const known = [...new Set(drugs.map(drug => drug.timesPerDay).filter((n): n is number => n !== null))];
  if (known.length <= 1) {
    return [{ key: SINGLE_GROUP_KEY, timesPerDay: known[0] ?? null, drugs }];
  }

  const groups: DoseGroup[] = known
    .sort((a, b) => b - a)
    .map(timesPerDay => ({
      key: `times-${timesPerDay}`,
      timesPerDay,
      drugs: drugs.filter(drug => drug.timesPerDay === timesPerDay),
    }));
  const unknown = drugs.filter(drug => drug.timesPerDay === null);
  if (unknown.length > 0) groups.push({ key: UNKNOWN_GROUP_KEY, timesPerDay: null, drugs: unknown });
  return groups;
}

// 줄 제목: "하루 3번 · 신일이부프로펜정 외 4개" (줄이 하나일 때는 쓰지 않는다)
export function getGroupTitle(group: DoseGroup) {
  const [first, ...rest] = group.drugs;
  const names = `${first?.name.trim() ?? ''}${rest.length > 0 ? ` 외 ${rest.length}개` : ''}`;
  const times = group.timesPerDay === null ? '하루 횟수 모름' : `하루 ${group.timesPerDay}번`;
  return `${times} · ${names}`;
}

// 기본 선택: 봉투 시간대 표시가 있고 그 개수가 이 줄의 하루 횟수와 같으면(횟수를 모르면 표시만으로) 그대로,
// 아니면 하루 횟수로(1 아침 / 2 아침·저녁 / 3 아침·점심·저녁 / 4 이상 네 칸), 정보가 없으면 아침
// 시간대 표시는 이 줄 약들의 것을 먼저 보고, 없으면 봉투 전체(모든 약)의 것을 본다
export function defaultSlotsForGroup(group: DoseGroup, allDrugs: DraftDrug[]): MedicationTimeSlot[] {
  const own = orderSlots(group.drugs.flatMap(drug => drug.slots));
  const marked = own.length > 0 ? own : orderSlots(allDrugs.flatMap(drug => drug.slots));
  if (marked.length > 0 && (group.timesPerDay === null || marked.length === group.timesPerDay)) return marked;
  if (group.timesPerDay === null) return ['MORNING'];
  return SLOTS_BY_TIMES_PER_DAY[Math.min(group.timesPerDay, 4)];
}

// 고른 칸 수가 봉투의 하루 횟수와 다르면 알린다(막지는 않는다). 칩은 4개라 5번 이상은 그 사실도 알린다
export function getTimesMismatchHint(group: DoseGroup, selected: MedicationTimeSlot[]) {
  if (group.timesPerDay === null || selected.length === group.timesPerDay) return null;
  const base = `봉투에는 하루 ${group.timesPerDay}번이에요`;
  return group.timesPerDay > SLOT_ORDER.length ? `${base}. 여기서는 ${SLOT_ORDER.length}번까지 고를 수 있어요` : base;
}

export function toggleSlot(selected: MedicationTimeSlot[], slot: MedicationTimeSlot) {
  return selected.includes(slot) ? selected.filter(item => item !== slot) : orderSlots([...selected, slot]);
}

export function groupToBatchRequest(group: DoseGroup, selected: MedicationTimeSlot[]): AddMedicationBatchReq {
  return {
    drugs: group.drugs.map(drug => ({ name: drug.name.trim(), doseAmount: drug.doseAmount })),
    times: orderSlots(selected).map(slot => ({ doseTime: `${DOSE_CHIPS[slot].time}:00` })),
  };
}
