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

// "아침 08:00 · 1정 · 식후 30분" 같은 목록 표시용 문구 조립
export function getMedicationSummaryText(medication: MedicationItem) {
  const parts = [`${getMedicationTimeSlotLabel(medication.timeSlot)} ${formatDoseTime(medication.doseTime)}`, `${medication.doseAmount}정`];
  if (medication.memo) parts.push(medication.memo);
  return parts.join(' · ');
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
