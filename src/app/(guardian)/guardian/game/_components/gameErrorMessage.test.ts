import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { gameErrorMessage } from './gameErrorMessage';

function apiError(status: number, code?: string) {
  return new AxiosError('error', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { success: false, code },
  });
}

describe('gameErrorMessage', () => {
  it('403 GAME_NOT_AUTHORIZED는 연결 상태 확인 안내', () => {
    expect(gameErrorMessage(apiError(403, 'GAME_NOT_AUTHORIZED'))).toBe(
      '연결된 피보호자의 게임 기록만 볼 수 있습니다. 연결 상태를 확인해 주세요.',
    );
  });

  it('503 GAME_UNAVAILABLE은 잠시 후 재시도 안내', () => {
    expect(gameErrorMessage(apiError(503, 'GAME_UNAVAILABLE'))).toBe(
      '게임 기록을 지금 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  });

  it('그 밖의 오류·코드 없음·오류 아님은 기존 문구', () => {
    expect(gameErrorMessage(apiError(500, 'INTERNAL_SERVER_ERROR'))).toBe('게임 기록을 불러오지 못했습니다.');
    expect(gameErrorMessage(apiError(404))).toBe('게임 기록을 불러오지 못했습니다.');
    expect(gameErrorMessage(new Error('network'))).toBe('게임 기록을 불러오지 못했습니다.');
    expect(gameErrorMessage(null)).toBe('게임 기록을 불러오지 못했습니다.');
  });
});
