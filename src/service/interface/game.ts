// 치매 예방 게임 응답 타입. 보호자는 BE 중계(/api/guardian/game/*)로 받는다 - 게임 번호(userId)·게임 내부 state는 BE가 빼고 wardId를 싣는다.
// BE는 AI가 빠뜨린 필드를 null로 싣는다(합계·활동 숫자만 0 기본값) - 화면에서 기본값을 둔다(FE #293 점검 L-1)
export interface IGameCatalog {
  slug: string;
  title: string | null;
  description: string | null;
  totalStages: number | null;
  themeColor: string | null;
}

export interface IGameProgress {
  gameSlug: string | null;
  currentStageNo: number | null;
  score: number | null;
  attempts: number | null;
  cleared: boolean | null;
  lastAnswerCorrect: boolean | null;
  startedAt: string | null;
  updatedAt: string | null;
  clearedAt: string | null;
}

export interface IWardGameSummary {
  wardId: string;
  totalScore: number;
  totalAttempts: number;
  lastPlayedAt: string | null;
  games: { game: IGameCatalog; progress: IGameProgress | null }[];
}

export interface IGameActivityDay {
  date: string; // YYYY-MM-DD (KST)
  attempts: number;
  correct: number;
  score: number;
}

export interface IWardGameActivity {
  wardId: string;
  days: number;
  activity: IGameActivityDay[];
}
