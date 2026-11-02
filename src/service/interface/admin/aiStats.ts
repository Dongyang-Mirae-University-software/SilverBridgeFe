export interface AdminChatStatsParams {
  from: string;
  to: string;
}

export interface AdminChatStats {
  from: string;
  to: string;
  totalChats: number | null;
  users: number | null;
  byRole: {
    guardian: number | null;
    ward: number | null;
    unknown: number | null;
  };
  byRoute: {
    reservation: number | null;
    symptom: number | null;
    general: number | null;
    unknown: number | null;
  };
  emergencyGuidance: number | null;
  reservationCompleted: number | null;
  fallbackReplies: number | null;
  daily: Array<{
    date: string;
    totalChats: number | null;
  }>;
  generatedAt: string;
}
