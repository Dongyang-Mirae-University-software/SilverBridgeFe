import type { ChatMessage } from '@/service/interface/chat';
import { formatDateShort } from '@/utils/reservation/reservationView';

/** 예약 대화의 의도 값(AI). */
export const RESERVATION_INTENT = 'hospital_reservation';

/**
 * 예약 진행·관리 단계의 선택 칸(AI ui.field). 이 칸을 받은 동안은 "눌러서 물어보세요" 칩을 숨기고 선택지를 패널에 보인다.
 * department 는 진료과 답(intent medical_advice)의 [가까운 ○○ 찾기]에도 쓰이므로 의도가 예약일 때만 예약 단계로 본다.
 * reservation_followup(예약 목록 보기 / 계속 상담하기)은 예약이 끝난 뒤라 넣지 않는다 - 칩이 돌아온다.
 */
const RESERVATION_FIELDS = new Set([
  'location_sido',
  'location',
  'location_confirm',
  'hospital',
  'hospital_confirm',
  'date',
  'time',
  'patient_name',
  'phone',
  'reservation_confirm',
  'reservation_edit',
  'reservation_id',
  'reservation_change_pick',
  'reservation_cancel_pick',
  'reservation_cancel_confirm',
]);

export const FOLLOWUP_FIELD = 'reservation_followup';
export const SHOW_LIST_VALUE = 'show_list';

/** 이름·전화는 서버가 채운다 - 이 칸이 오면 입력 칸 대신 안내를 보인다(등록된 전화가 없을 때만 온다). */
export const PERSONAL_FIELDS = new Set(['patient_name', 'phone']);

export function isReservationStep(message: ChatMessage | undefined): boolean {
  const field = message?.ui?.field;
  if (!message || !field || field === FOLLOWUP_FIELD) return false;
  if (RESERVATION_FIELDS.has(field)) return true;
  return message.intent === RESERVATION_INTENT;
}

/**
 * 보호자 챗봇 예약 대상 선택(AI #255·#256, BE #472 - 2026-11-11). AI가 wardId 없이 예약이 시작되면 이 칸으로
 * "누구의 병원 예약인가요?"를 묻는다(값 = 피보호자 ID, 보호자 본인 선택지는 없다).
 */
export const RESERVATION_TARGET_FIELD = 'reservation_patient';
/** 이 도구의 답이 오면 예약 흐름이 끝난 것이다 - 다음 글 입력부터 wardId 를 싣지 않는다. */
const RESERVATION_END_TOOLS = new Set(['make_appointment', 'cancel_reservation']);

/**
 * 버튼(선택지·카드 버튼)을 눌렀을 때 실을 wardId(계약 ③). 대상 선택지는 고른 값,
 * 그 밖의 버튼은 그 버튼이 달린 답을 받았던 요청의 wardId 를 그대로 싣는다.
 * 코드 값(__self__ 등)은 피보호자가 아니므로 싣지 않는다.
 */
export function buttonWardId(field: string, value: string, source: ChatMessage | undefined): string | undefined {
  if (field === RESERVATION_TARGET_FIELD) return value && !value.startsWith('__') ? value : undefined;
  return source?.requestWardId;
}

/**
 * 글·칩 입력에 실을 wardId(계약 ③). 직전 답이 wardId 를 실은 요청의 답이고, 아직 예약 흐름 안
 * (intent 예약, 완료·취소 도구 아님)일 때만 싣는다. 새 대화는 답이 비워져 자연히 풀린다.
 */
export function textWardId(last: ChatMessage | undefined): string | undefined {
  if (!last?.requestWardId || last.intent !== RESERVATION_INTENT) return undefined;
  if (last.tool && RESERVATION_END_TOOLS.has(last.tool)) return undefined;
  return last.requestWardId;
}

/** 예약 목록 보기는 AI로 보내지 않고 역할별 병원 가는 날 화면으로 간다. */
export function isShowList(field: string, value: string) {
  return field === FOLLOWUP_FIELD && value === SHOW_LIST_VALUE;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 내 말풍선에 보일 글자. 선택지의 value(show_list·__type__·예약 ID 등)는 화면에 내지 않는다.
 * label 이 없으면 날짜는 "11월 10일 (화)", 코드 값(__로 시작)은 "선택했어요", 그 밖은 value.
 */
export function selectionText(value: string, label?: string) {
  const shown = label?.trim();
  if (shown) return shown;
  if (ISO_DATE.test(value)) return formatDateShort(value);
  if (value.startsWith('__') || value === SHOW_LIST_VALUE) return '선택했어요';
  return value;
}
