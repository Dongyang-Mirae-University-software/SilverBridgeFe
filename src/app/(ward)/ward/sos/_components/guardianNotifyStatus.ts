import { useSyncExternalStore } from 'react';

// SOS 보호자 알림 전송 상태 - 119 키패드는 모달 저장소에 "열 때의 요소"로 들어가 부모가 다시 그려도 바뀌지 않으므로,
// 키패드가 이 저장소를 직접 구독해 전송 결과를 보여 준다. "알렸어요"는 성공 응답을 받은 뒤에만 쓴다(거짓 안내 금지)
// null = 표시하지 않음(연결된 보호자가 없거나 아직 누르지 않음)
export type GuardianNotifyStatus = 'sending' | 'sent' | 'failed' | null;

let status: GuardianNotifyStatus = null;
const listeners = new Set<() => void>();

export function setGuardianNotifyStatus(next: GuardianNotifyStatus) {
  status = next;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return status;
}

export function useGuardianNotifyStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
