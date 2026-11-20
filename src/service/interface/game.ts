// 치매 예방 게임 응답 타입. 보호자는 BE 중계(/api/guardian/game/*)로 받는다 - 게임 번호(userId)·게임 내부 state는 BE가 빼고 wardId를 싣는다.
export interface IGameCatalog {
  slug: string;
  title: string;
  description: string;
  totalStages: number;
  themeColor: string;
}

export interface IGameProgress {
  gameSlug: string;
  currentStageNo: number;
  score: number;
  attempts: number;
  cleared: boolean;
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
