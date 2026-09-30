// AI 서버 치매 예방 게임(/api/v1/games/**) 응답 타입. FE는 /api/streams 프록시로 호출한다.
export interface IGameCatalog {
  slug: string;
  title: string;
  description: string;
  totalStages: number;
  themeColor: string;
}

export interface IGameProgress {
  userId: number;
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
  userId: number;
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
  userId: number;
  days: number;
  activity: IGameActivityDay[];
}
