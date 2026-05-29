export interface LiveStreamSession {
  session_id: string;
  ward_name?: string;
  ward_id?: string;
  started_at?: string;
  fps?: number;
  is_analyzing?: boolean;
}

export interface LiveStreamStatus {
  session_id?: string;
  fps?: number;
  viewer_count?: number;
  is_analyzing?: boolean;
  started_at?: string;
}

export interface LiveStreamAnalysis {
  label?: string;
  confidence?: number;
  danger?: boolean;
  detected_at?: string;
  class_name?: string;
}

export type DetectState = 'fire' | 'smoke' | 'danger' | 'safe';

export function resolveDetectState(analysis: LiveStreamAnalysis | null | undefined): DetectState {
  if (!analysis) return 'safe';
  if (analysis.label === 'fire') return 'fire';
  if (analysis.label === 'smoke') return 'smoke';
  if (analysis.danger) return 'danger';
  return 'safe';
}
