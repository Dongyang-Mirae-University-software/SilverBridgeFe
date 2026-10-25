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

// 피보호자 화면의 복용 시각 - 시니어가 읽기 쉽게 "오전 8시"·"오후 1시 30분"(Claude Design 2026-10-24)
export function formatDoseTimeKorean(doseTime: string) {
  const [hour, minute] = doseTime.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return formatDoseTime(doseTime);
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}시${minute ? ` ${minute}분` : ''}`;
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

// 보호자 카드: 같은 시간대·시각의 약을 한 번으로 묶는다(약 6개 × 하루 3번이면 "18번"이 아니라 "3번") - 2026-10-23
// 오늘 등록 전이었던 약(beforeRegistered)은 그 묶음의 판정·개수에서 뺀다(그날은 먹을 기회가 없었다)
export interface MedicationTimeGroup {
  key: string;
  timeSlot: MedicationTimeSlot;
  doseTime: string;
  label: string; // "아침" - 같은 시간대가 둘 이상이면 "저녁 19:00"처럼 시각을 붙인다
  medications: MedicationItem[];
  takenCount: number; // 판정에 드는 약 중 체크한 수
  countedCount: number; // 판정에 드는 약 수(오늘 등록 전이었던 약 제외)
  status: DoseStatus;
}

export function groupMedicationsByTime(medications: MedicationItem[], nowHHmm: string, doseDate: string) {
  const groups = new Map<string, MedicationItem[]>();
  sortMedicationsByDoseTime(medications).forEach(medication => {
    const key = `${medication.timeSlot}-${formatDoseTime(medication.doseTime)}`;
    groups.set(key, [...(groups.get(key) ?? []), medication]);
  });
  const slotCounts = new Map<MedicationTimeSlot, number>();
  groups.forEach(items => slotCounts.set(items[0].timeSlot, (slotCounts.get(items[0].timeSlot) ?? 0) + 1));

  return [...groups.entries()].map(([key, items]): MedicationTimeGroup => {
    const { timeSlot, doseTime } = items[0];
    const statuses = items.map(medication => getDoseStatus(medication, nowHHmm, doseDate));
    const counted = items.filter((_, index) => statuses[index] !== 'beforeRegistered');
    const takenCount = counted.filter(medication => medication.taken).length;
    let status: DoseStatus;
    if (counted.length === 0) status = 'beforeRegistered';
    else if (takenCount === counted.length) status = 'done';
    else status = statuses.includes('miss') ? 'miss' : 'later';
    const slotLabel = getMedicationTimeSlotLabel(timeSlot);
    return {
      key,
      timeSlot,
      doseTime,
      label: (slotCounts.get(timeSlot) ?? 0) > 1 ? `${slotLabel} ${formatDoseTime(doseTime)}` : slotLabel,
      medications: items,
      takenCount,
      countedCount: counted.length,
      status,
    };
  });
}

// 묶음 상태 문구: "다 드셨어요" / "6개 중 4개 드셨어요" / "아직 체크 전이에요" / "드실 시간 전" / "오늘은 등록 전이었어요"
export function getTimeGroupStatusLabel(group: MedicationTimeGroup) {
  switch (group.status) {
    case 'done':
      return '다 드셨어요';
    case 'miss':
      return group.takenCount > 0 ? `${group.countedCount}개 중 ${group.takenCount}개 드셨어요` : '아직 체크 전이에요';
    case 'later':
      return '드실 시간 전';
    default:
      return '오늘은 등록 전이었어요';
  }
}

// "코싹열정, 신일이부프로펜정 외 4개"
export function summarizeMedicationNames(medications: MedicationItem[], shown = 2) {
  const names = medications.map(medication => medication.name);
  const rest = names.length - shown;
  return rest > 0 ? `${names.slice(0, shown).join(', ')} 외 ${rest}개` : names.join(', ');
}

// 보호자 카드 맨 위 한 문장 - "N번 중 M번"은 약이 많으면 뜻을 알기 어려워 시간대 기준으로 말한다(2026-10-24 사용자 요청)
// 지금까지 시간이 지난 마지막 시간대를 기준으로: 다 드셨으면 "아침 약을 다 드셨어요", 아니면 "점심 약이 아직 체크되지 않았어요"
// ("안 드셨어요"로 단정하지 않는다 - 체크 누락과 실제 미복용을 구분할 수 없다). 그보다 앞 시간대에 남은 게 있으면 sub로 알린다
export interface TodayHeadline {
  text: string;
  tone: 'done' | 'miss' | 'later';
  sub: string | null;
}

export function getTodayHeadline(groups: MedicationTimeGroup[]): TodayHeadline | null {
  const counted = groups.filter(group => group.status !== 'beforeRegistered');
  if (counted.length === 0) return null;
  if (counted.every(group => group.status === 'done')) return { text: '오늘 약을 모두 드셨어요', tone: 'done', sub: null };

  const passed = counted.filter(group => group.status !== 'later');
  if (passed.length === 0) {
    const next = counted[0];
    return { text: `${next.label} 약은 ${formatDoseTime(next.doseTime)}에 드세요`, tone: 'later', sub: null };
  }
  const current = passed[passed.length - 1];
  const earlierMissed = passed.slice(0, -1).filter(group => group.status === 'miss');
  const sub = earlierMissed.length > 0 ? `${earlierMissed.map(group => group.label).join('·')} 약도 아직 체크되지 않았어요` : null;
  return current.status === 'done'
    ? { text: `${current.label} 약을 다 드셨어요`, tone: 'done', sub }
    : { text: `${current.label} 약이 아직 체크되지 않았어요`, tone: 'miss', sub };
}
