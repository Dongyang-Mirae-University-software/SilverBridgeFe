import type { IWardCompanionToday } from '@/service/interface/ward/companion';

/**
 * 지금 대화를 열 수 있는 시간대. currentSlot(60분 창 안)이고 그 시간대가 아직 열 수 있을 때(AVAILABLE)나
 * 하던 대화가 있을 때(IN_PROGRESS)만 돌려준다. 이미 마친 시간대(DONE)는 서버가 다시 열지 않으므로(COMPANION_SLOT_DONE)
 * 창이 열려 있어도 null - 홈 카드·말벗 화면 시작 버튼·시간 밖 홈 이동이 같은 판정을 쓴다(2026-11-11 기능 점검 F-1).
 */
export function openCompanionSlot(today: IWardCompanionToday | null | undefined): string | null {
  if (!today?.currentSlot) return null;
  const current = today.slots.find(slot => slot.slot === today.currentSlot);
  return current?.status === 'AVAILABLE' || current?.status === 'IN_PROGRESS' ? today.currentSlot : null;
}
