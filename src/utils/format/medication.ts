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
