export interface LiveStreamSession {
  session_id: string;
  ward_name?: string;
  ward_id?: string;
  started_at?: string;
  viewerUrl?: string;
  viewer_url?: string;
  fps?: number;
  is_analyzing?: boolean;
}

export interface LiveStreamStatus {
  session_id?: string;
  status?: string;
  fps?: number;
  lastFrameAt?: string | null;
  last_frame_at?: string | null;
  viewerCount?: number;
  viewer_count?: number;
  isAnalyzing?: boolean;
  is_analyzing?: boolean;
  started_at?: string;
}

export interface LiveStreamAnalysis {
  detectedType?: string;
  detected_type?: string;
  label?: string;
  confidence?: number;
  danger?: boolean;
  detected_at?: string;
  class_name?: string;
  latestFrameUrl?: string;
  latest_frame_url?: string;
  frameUrl?: string;
  frame_url?: string;
  imageUrl?: string;
  image_url?: string;
}

export type DetectState = 'fire' | 'smoke' | 'knife' | 'fall' | 'person' | 'danger' | 'safe';

export function resolveDetectState(analysis: LiveStreamAnalysis | null | undefined): DetectState {
  if (!analysis) return 'safe';
  const raw = (analysis.detectedType ?? analysis.detected_type ?? analysis.label ?? analysis.class_name ?? '').toLowerCase();

  if (raw === 'fire') return 'fire';
  if (raw === 'smoke') return 'smoke';
  if (['knife', 'weapon', 'scissors', 'gun'].some(k => raw.includes(k))) return 'knife';
  if (['fall', 'fallen', 'tumble'].some(k => raw.includes(k)))           return 'fall';
  if (['person', 'people', 'human'].some(k => raw.includes(k)))          return 'person';
  if (analysis.danger) return 'danger';
  return 'safe';
}
