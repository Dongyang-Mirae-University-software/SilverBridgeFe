// 새 카메라 등록 흐름: 등록 → 송출 시작 → 창 닫기.
// 확인은 목록 카드의 '카메라 화면 보기'로 하므로 성공하면 창을 바로 닫는다.
// 송출 시작이 실패하면 창을 닫지 않는다 - 카메라는 이미 등록돼 있어 그 자리에서 다시 시작하게 안내한다.
export type RegisterFlowResult =
  | { kind: 'started' }
  | { kind: 'registerFailed'; error: unknown }
  | { kind: 'startFailed' };

export async function registerAndStart<C>(deps: {
  register: () => Promise<C | null | undefined>;
  onRegistered?: (camera: C) => void;
  start: (camera: C) => Promise<void>;
  onStarted: () => void;
}): Promise<RegisterFlowResult> {
  let camera: C | null | undefined;
  try {
    camera = await deps.register();
  } catch (error) {
    return { kind: 'registerFailed', error };
  }
  if (!camera) return { kind: 'registerFailed', error: undefined };

  deps.onRegistered?.(camera);
  try {
    await deps.start(camera);
  } catch {
    return { kind: 'startFailed' };
  }
  deps.onStarted();
  return { kind: 'started' };
}
