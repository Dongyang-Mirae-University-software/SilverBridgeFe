import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { hasUserSavedWardSosSetting, wardSosSettingUpdateMutationKey } from './sosSetting';

function runSave(client: QueryClient, result: 'pending' | 'success' | 'error') {
  const observer = new MutationObserver(client, {
    mutationKey: wardSosSettingUpdateMutationKey,
    mutationFn: () =>
      result === 'pending'
        ? new Promise(() => undefined)
        : result === 'success'
          ? Promise.resolve({ sosAction: 'NOTIFY_GUARDIAN_FIRST' })
          : Promise.reject(new Error('서버 오류')),
  });
  return observer.mutate().catch(() => undefined);
}

describe('hasUserSavedWardSosSetting', () => {
  // 레이아웃의 첫 SOS 동기화가 늦게 오면, 사용자가 먼저 고른 값을 옛 서버 값으로 덮지 않아야 한다(점검 L-2)
  it('저장한 적이 없으면 첫 동기화를 한다', () => {
    expect(hasUserSavedWardSosSetting(new QueryClient())).toBe(false);
  });

  it('저장이 진행 중이거나 성공했으면 첫 동기화를 건너뛴다', async () => {
    const pending = new QueryClient();
    void runSave(pending, 'pending');
    await Promise.resolve();
    expect(hasUserSavedWardSosSetting(pending)).toBe(true);

    const success = new QueryClient();
    await runSave(success, 'success');
    expect(hasUserSavedWardSosSetting(success)).toBe(true);
  });

  it('실패한 저장은 화면이 이미 되돌아가 있어 세지 않는다', async () => {
    const failed = new QueryClient();
    await runSave(failed, 'error');
    expect(hasUserSavedWardSosSetting(failed)).toBe(false);
  });

  it('다른 저장(다른 mutationKey)은 세지 않는다', async () => {
    const client = new QueryClient();
    await new MutationObserver(client, { mutationKey: ['other'], mutationFn: () => Promise.resolve(1) }).mutate();
    expect(hasUserSavedWardSosSetting(client)).toBe(false);
  });
});
