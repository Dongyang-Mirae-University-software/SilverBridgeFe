import type { LiveStreamAnalysis, LiveStreamSession, LiveStreamStatus } from '@/service/interface/liveStream';

export function normalizeSessions(data: unknown) {
  if (!Array.isArray(data)) return null;

  return data.map(item => {
    const session = item as Record<string, unknown>;

    return {
      ...session,
      session_id: String(session.session_id ?? session.sessionId ?? session.id ?? ''),
      viewerUrl: getString(session.viewerUrl),
      viewer_url: getString(session.viewer_url),
    } as LiveStreamSession;
  });
}

export function normalizeStatus(data: unknown): LiveStreamStatus | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;

  return {
    fps: getNumber(raw.fps),
    isAnalyzing: getBoolean(raw.isAnalyzing),
    is_analyzing: getBoolean(raw.is_analyzing),
    lastFrameAt: getString(raw.lastFrameAt),
    last_frame_at: getString(raw.last_frame_at),
    session_id: getString(raw.session_id) ?? getString(raw.sessionId),
    started_at: getString(raw.started_at),
    status: getString(raw.status),
    viewerCount: getNumber(raw.viewerCount),
    viewer_count: getNumber(raw.viewer_count),
  };
}

export function normalizeAnalysis(data: unknown): LiveStreamAnalysis | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;

  return {
    class_name: getString(raw.class_name),
    confidence: getNumber(raw.confidence),
    danger: getBoolean(raw.danger),
    detected_at: getString(raw.detected_at),
    detected_type: getString(raw.detected_type),
    detectedType: getString(raw.detectedType),
    frame_url: getString(raw.frame_url),
    frameUrl: getString(raw.frameUrl),
    image_url: getString(raw.image_url),
    imageUrl: getString(raw.imageUrl),
    label: getString(raw.label) ?? getString(raw.className),
    latest_frame_url: getString(raw.latest_frame_url),
    latestFrameUrl: getString(raw.latestFrameUrl),
  };
}

export function getEventSessionId(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;

  return getString(raw.session_id) ?? getString(raw.sessionId);
}

export function getLatestFrameUrl(analysis: LiveStreamAnalysis) {
  return analysis.latestFrameUrl ?? analysis.latest_frame_url ?? analysis.frameUrl ?? analysis.frame_url ?? analysis.imageUrl ?? analysis.image_url ?? null;
}

export function normalizeDetectedType(analysis: LiveStreamAnalysis) {
  const rawType = analysis.detectedType ?? analysis.detected_type ?? analysis.label ?? analysis.class_name;

  if (rawType === 'fire') return '화재';
  if (rawType === 'smoke') return '연기';
  if (rawType === 'danger') return '위험';
  return '화재·연기';
}

export function formatNumber(value: number | undefined) {
  return value == null ? '-' : String(value);
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function getBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
