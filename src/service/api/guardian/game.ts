// 보호자(GUARDIAN)가 피보호자의 치매 예방 게임 진행 상황을 조회 — AI 서버 games API(/api/streams 프록시 경유)
import { streamClient } from '@/lib/api/streamClient';
import { CommonResponse } from '../../interface/common';
import { IWardGameActivity, IWardGameSummary } from '../../interface/game';

export async function getWardGameSummary(gameUserId: number) {
  const res = await streamClient.get<CommonResponse<IWardGameSummary>>('/v1/games/progress', {
    params: { userId: gameUserId },
  });
  return res.data.data ?? null;
}

export async function getWardGameActivity(gameUserId: number, days = 182) {
  const res = await streamClient.get<CommonResponse<IWardGameActivity>>('/v1/games/activity', {
    params: { userId: gameUserId, days },
  });
  return res.data.data?.activity ?? [];
}
