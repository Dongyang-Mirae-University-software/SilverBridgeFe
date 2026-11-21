import { isAxiosError } from 'axios';

// BE 중계 오류 코드별 안내 - 403은 연결이 끊겼거나 바뀐 경우, 503은 게임 서버(AI) 장애
export function gameErrorMessage(error: unknown) {
  const code = isAxiosError<{ code?: string }>(error) ? error.response?.data?.code : undefined;
  if (code === 'GAME_NOT_AUTHORIZED') return '연결된 어르신의 게임 기록만 볼 수 있습니다. 연결 상태를 확인해 주세요.';
  if (code === 'GAME_UNAVAILABLE') return '게임 기록을 지금 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.';
  return '게임 기록을 불러오지 못했습니다.';
}
