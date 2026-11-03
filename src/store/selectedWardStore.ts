import { useEffect, useSyncExternalStore } from 'react';

// 보호자가 고른 피보호자(partnerUserId). 대시보드·이상감지·SOS·복약·챗봇·병원 예약 어디서 골라도 다른 화면에서 같은 사람을 본다.
// 새로고침해도 남도록 탭 저장소(sessionStorage)에 같이 둔다. 로그아웃하면 clearAuthTokens 가 지운다.
// 골랐던 사람이 연결 목록에 없으면(연결 해제·다른 계정) 각 화면이 첫 번째 피보호자를 보여 준다.
const STORAGE_KEY = 'careai_selected_ward_id';

type Listener = () => void;

const listeners = new Set<Listener>();
let selectedWardId: string | null = null;
let loadedFromStorage = false;

function readStorage() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(wardId: string | null) {
  try {
    if (wardId) window.sessionStorage.setItem(STORAGE_KEY, wardId);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장소를 못 쓰면(사생활 보호 모드 등) 이 탭 메모리에만 둔다
  }
}

function getSnapshot() {
  if (!loadedFromStorage) {
    loadedFromStorage = true;
    selectedWardId = readStorage();
  }
  return selectedWardId;
}

// 서버 렌더·하이드레이션 첫 렌더는 저장소를 모르므로 선택 없음(첫 번째 피보호자)으로 그린다
function getServerSnapshot() {
  return null;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSelectedWardId(wardId: string | null) {
  loadedFromStorage = true;
  if (selectedWardId === wardId) return;
  selectedWardId = wardId;
  writeStorage(wardId);
  listeners.forEach(listener => listener());
}

export function clearSelectedWardId() {
  setSelectedWardId(null);
}

export default function useSelectedWardId() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

interface UseSelectedWardOptions {
  // 이 화면 목록이 연결된 피보호자 전체가 아닐 수 있으면 false - 고른 사람이 목록에 없다고 전역 선택을 바꾸지 않는다
  replaceMissing?: boolean;
}

// 화면에 보일 피보호자를 정하는 단 한 곳. 고른 사람이 목록에 있으면 그 사람, 없으면 첫 번째.
// 화면마다 목록 순서가 달라 "첫 번째"가 서로 다를 수 있다 - 그래서 보이게 된 사람을 전역 선택으로 남겨
// 처음 들른 화면의 피보호자가 다른 화면에서도 그대로 보이게 한다
export function useSelectedWard<T>(
  wards: readonly T[],
  getId: (ward: T) => string,
  { replaceMissing = true }: UseSelectedWardOptions = {},
) {
  const selectedWardId = useSelectedWardId();
  const selectedWard = wards.find(ward => getId(ward) === selectedWardId) ?? wards[0] ?? null;
  const resolvedWardId = selectedWard ? getId(selectedWard) : null;
  const wardIds = wards.map(getId).join('\n');

  useEffect(() => {
    if (!resolvedWardId) return;
    // 하이드레이션 첫 렌더는 서버 값(null)으로 그리므로, 그린 값이 아니라 저장소의 지금 값으로 판단한다
    const current = getSnapshot();
    if (current === resolvedWardId) return;
    const currentInList = current !== null && wardIds.split('\n').includes(current);
    if (current === null || (replaceMissing && !currentInList)) setSelectedWardId(resolvedWardId);
  }, [replaceMissing, resolvedWardId, wardIds]);

  return selectedWard;
}
