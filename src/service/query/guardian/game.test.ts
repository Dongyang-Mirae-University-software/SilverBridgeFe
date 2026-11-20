import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  streamGet: vi.fn(),
}));

vi.mock('@/lib/api/apiClient', () => ({ apiClient: { get: mocks.apiGet } }));
vi.mock('@/lib/api/streamClient', () => ({ streamClient: { get: mocks.streamGet } }));

import { wardGameActivityQueryOptions, wardGameSummaryQueryKey, wardGameSummaryQueryOptions } from './game';

// apiClient 응답 인터셉터는 본문({success, message, data})을 그대로 돌려준다
function body<T>(data: T) {
  return { success: true, message: 'ok', data };
}

function runQuery<T>(options: { queryFn?: unknown }) {
  return (options.queryFn as () => Promise<T>)();
}

describe('보호자 게임 쿼리 (BE 중계)', () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.streamGet.mockReset();
  });

  // 새로고침 버튼은 접두어 키 하나로 요약·활동을 함께 무효화한다
  it('쿼리 키는 접두어 아래에 피보호자 ID(wardId)를 그대로 싣는다', () => {
    const summaryKey = wardGameSummaryQueryOptions('aB3x9Z').queryKey;
    const activityKey = wardGameActivityQueryOptions('aB3x9Z').queryKey;
    expect(summaryKey).toEqual([...wardGameSummaryQueryKey, 'aB3x9Z']);
    expect(activityKey).toEqual([...wardGameSummaryQueryKey, 'activity', 'aB3x9Z']);
    expect(wardGameSummaryQueryOptions('other1').queryKey).not.toEqual(summaryKey);
  });

  it('요약은 BE /guardian/game/progress 를 wardId로 부르고 스트림 프록시는 쓰지 않는다', async () => {
    const summary = { wardId: 'aB3x9Z', totalScore: 120, totalAttempts: 9, lastPlayedAt: null, games: [] };
    mocks.apiGet.mockResolvedValue(body(summary));

    await expect(runQuery(wardGameSummaryQueryOptions('aB3x9Z'))).resolves.toEqual(summary);
    expect(mocks.apiGet).toHaveBeenCalledWith('/guardian/game/progress', { params: { wardId: 'aB3x9Z' } });
    expect(mocks.streamGet).not.toHaveBeenCalled();
  });

  it('활동은 BE /guardian/game/activity 를 wardId로 부르고(days는 BE 기본값) activity 배열만 돌려준다', async () => {
    const activity = [{ date: '2026-11-17', attempts: 4, correct: 3, score: 30 }];
    mocks.apiGet.mockResolvedValue(body({ wardId: 'aB3x9Z', days: 182, activity }));

    await expect(runQuery(wardGameActivityQueryOptions('aB3x9Z'))).resolves.toEqual(activity);
    expect(mocks.apiGet).toHaveBeenCalledWith('/guardian/game/activity', { params: { wardId: 'aB3x9Z' } });
    expect(mocks.streamGet).not.toHaveBeenCalled();
  });

  it('응답 data가 비면 요약은 null, 활동은 빈 배열', async () => {
    mocks.apiGet.mockResolvedValue(body(null));
    await expect(runQuery(wardGameSummaryQueryOptions('aB3x9Z'))).resolves.toBeNull();
    await expect(runQuery(wardGameActivityQueryOptions('aB3x9Z'))).resolves.toEqual([]);
  });
});
