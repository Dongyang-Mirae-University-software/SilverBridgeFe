import { MedicationItem, MedicationTimeSlot } from '@/service/interface/medication';

const TIME_SLOT_LABEL: Record<MedicationTimeSlot, string> = {
  MORNING: '아침',
  LUNCH: '점심',
  DINNER: '저녁',
  BEDTIME: '취침 전',
};

export function getMedicationTimeSlotLabel(timeSlot: MedicationTimeSlot) {
  return TIME_SLOT_LABEL[timeSlot];
}

// "08:00:00" -> "08:00"
export function formatDoseTime(doseTime: string) {
  return doseTime.slice(0, 5);
}

// 목록·피보호자 화면의 복용량 표시 - BE 알림 문구(DoseAmounts.label)와 같다: 0.5 → "반 알", 1.5 → "1정 반", 2 → "2정"
export function formatDoseAmount(doseAmount: number) {
  if (doseAmount === 0.5) return '반 알';
  const whole = Math.floor(doseAmount);
  return doseAmount - whole === 0.5 ? `${whole}정 반` : `${doseAmount}정`;
}

// "아침 08:00 · 1정 · 식후 30분" 같은 목록 표시용 문구 조립
export function getMedicationSummaryText(medication: MedicationItem) {
  const parts = [`${getMedicationTimeSlotLabel(medication.timeSlot)} ${formatDoseTime(medication.doseTime)}`, formatDoseAmount(medication.doseAmount)];
  if (medication.memo) parts.push(medication.memo);
  return parts.join(' · ');
}

// 보호자 카드의 오늘 복용 상태
// - beforeRegistered: 오늘 등록했는데 등록 시각이 복용 시각보다 늦다 - 그날은 먹을 기회가 없었으므로 "지난 약"으로 세지 않는다
export type DoseStatus = 'done' | 'miss' | 'later' | 'beforeRegistered';

const KST_DATE_TIME = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hourCycle: 'h23',
});

// ISO 시각 → KST 날짜 "2026-10-22" · 시각 "14:00:00.000". 읽을 수 없으면 null
export function toKstDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    KST_DATE_TIME.formatToParts(date).find(item => item.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}:${part('second')}.${part('fractionalSecond')}`,
  };
}

// 그날(KST) 등록됐고 등록 시각이 복용 시각보다 늦은지 - BE MedicationClock.registeredAfterDose와 같은 기준
// 정각 등록은 센다(늦지 않음). 등록 시각을 모르면 예전처럼 센다
export function isRegisteredAfterDose(medication: MedicationItem, doseDate: string) {
  if (!medication.createdAt) return false;
  const registered = toKstDateTime(medication.createdAt);
  if (!registered) return false;
  const doseTime = `${medication.doseTime.slice(0, 8).padEnd(8, ':00')}.000`;
  return registered.date === doseDate && registered.time > doseTime;
}

// nowHHmm: 지금 KST "HH:mm", doseDate: 카드 기준일(KST)
export function getDoseStatus(medication: MedicationItem, nowHHmm: string, doseDate: string): DoseStatus {
  if (medication.taken) return 'done';
  if (formatDoseTime(medication.doseTime) > nowHHmm) return 'later';
  return isRegisteredAfterDose(medication, doseDate) ? 'beforeRegistered' : 'miss';
}

export function sortMedicationsByDoseTime(medications: MedicationItem[]) {
  return [...medications].sort((a, b) => a.doseTime.localeCompare(b.doseTime));
}

export function getLatestDoseTime(medications: MedicationItem[]) {
  if (medications.length === 0) return null;
  return medications.reduce(
    (latest, medication) => (medication.doseTime > latest ? medication.doseTime : latest),
    '00:00:00',
  );
}

export function formatMedicationAlertTime(value: string) {
  const [hourValue = '0', minuteValue = '00'] = value.split(':');
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return value.slice(0, 5);
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}:${minuteValue}`;
}
