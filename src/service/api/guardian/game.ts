// 보호자(GUARDIAN)가 피보호자의 치매 예방 게임 진행 상황을 조회 - BE 중계(/api/guardian/game/*)
// Swagger 그룹: "보호자 - 게임". ACTIVE 연결된 피보호자만, 아니면 403 GAME_NOT_AUTHORIZED / AI 장애 503 GAME_UNAVAILABLE
// 게임 사용자 번호는 BE가 wardId로 계산한다 - 보호자 화면에서 toGameUserId를 쓰지 말 것(남의 기록 조회 경로가 된다)

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import { IWardGameActivity, IWardGameSummary } from '../../interface/game';

export async function getWardGameSummary(wardId: string) {
  const response = await apiClient.get<CommonResponse<IWardGameSummary>>('/guardian/game/progress', {
    params: { wardId },
  });
  return getResponseData<IWardGameSummary>(response);
}

// days 생략 시 BE 기본 182일(1~366, 밖이면 400 GAME_INVALID_DAYS)
export async function getWardGameActivity(wardId: string, days?: number) {
  const response = await apiClient.get<CommonResponse<IWardGameActivity>>('/guardian/game/activity', {
    params: days === undefined ? { wardId } : { wardId, days },
  });
  return getResponseData<IWardGameActivity>(response)?.activity ?? [];
}
