// 안부 말벗 시간대 표기 - 보호자 AI 기분 체크와 피보호자 안부 말벗이 같이 쓴다
// "09:00" → "오전 9시", "12:00" → "낮 12시", "18:30" → "오후 6시 30분". 형식이 다르면 받은 값 그대로
export function formatSlotTime(slot: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(slot);
  if (!match) return slot;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = hour < 12 ? '오전' : hour === 12 ? '낮' : '오후';
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}시${minute ? ` ${minute}분` : ''}`;
}
