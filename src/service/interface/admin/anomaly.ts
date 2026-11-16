export type AdminAnomalyPeriod = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL';
export type AdminAnomalyType = 'FIRE' | 'FALL' | 'WEAPON';
export type AdminAnomalyReviewStatus = 'PENDING' | 'REAL' | 'FALSE_ALARM' | 'CONFLICTED';

export interface AdminAnomalyParams { period?: AdminAnomalyPeriod; type?: AdminAnomalyType; status?: AdminAnomalyReviewStatus; wardId?: string; keyword?: string; page: number; size: number; }
export interface AdminAnomalySummaryParams { period?: AdminAnomalyPeriod; type?: AdminAnomalyType; keyword?: string; }
export interface AdminAnomalyItem { incidentId: number; wardId: string; wardName: string | null; cameraLabel: string | null; detectedType: AdminAnomalyType; detectedTypeLabel: string; startedAt: string; lastDetectedAt: string; durationMinutes: number; eventCount: number; maxConfidence: number; reviewStatus: AdminAnomalyReviewStatus; feedbacks: Array<{ guardianId: string; guardianName: string | null; verdict: 'REAL' | 'FALSE_ALARM'; respondedAt: string }>; }
export interface AdminAnomalyPage { content: AdminAnomalyItem[]; page: number; size: number; totalElements: number; totalPages: number; last: boolean; }
// 유형별 건수 - 실제 응답 칸은 type(QA ADM-A13), Swagger 예시는 detectedType이라 둘 다 받는다
export interface AdminAnomalyTypeCount { type?: AdminAnomalyType; detectedType?: AdminAnomalyType; label?: string; count: number; }
export interface AdminAnomalySummary { period: AdminAnomalyPeriod; total: number; byType: AdminAnomalyTypeCount[]; review: { pending: number; real: number; falseAlarm: number; conflicted: number }; responseRate: number | null; aiConfidence: { average: number | null; basis: number }; }
