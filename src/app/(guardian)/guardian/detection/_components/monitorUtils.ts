import type {
  LiveStreamAnalysis,
  LiveStreamDetection,
  LiveStreamDetectionBox,
  LiveStreamSession,
  LiveStreamStatus,
} from '@/service/interface/liveStream';

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
    detections: getDetections(raw.detections),
  };
}

function getDetectionBox(value: unknown): LiveStreamDetectionBox | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const x1 = getNumber(raw.x1);
  const y1 = getNumber(raw.y1);
  const x2 = getNumber(raw.x2);
  const y2 = getNumber(raw.y2);

  if (x1 == null || y1 == null || x2 == null || y2 == null) return undefined;
  return { x1, y1, x2, y2 };
}

function getDetections(value: unknown): LiveStreamDetection[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const detections = value.reduce<LiveStreamDetection[]>((acc, item) => {
    if (!item || typeof item !== 'object') return acc;
    const raw = item as Record<string, unknown>;
    const bbox = getDetectionBox(raw.bbox);
    if (!bbox) return acc;

    acc.push({ detectedType: getString(raw.detectedType), confidence: getNumber(raw.confidence), bbox });
    return acc;
  }, []);

  return detections.length > 0 ? detections : undefined;
}

export function getEventSessionId(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;

  return getString(raw.session_id) ?? getString(raw.sessionId);
}

export function getLatestFrameUrl(analysis: LiveStreamAnalysis) {
  return analysis.latestFrameUrl ?? analysis.latest_frame_url ?? analysis.frameUrl ?? analysis.frame_url ?? analysis.imageUrl ?? analysis.image_url ?? null;
}

export function normalizeDetectedType(analysis: LiveStreamAnalysis): string {
  const raw = (analysis.detectedType ?? analysis.detected_type ?? analysis.label ?? analysis.class_name ?? '').toLowerCase();

  if (raw === 'fire') return '화재';
  if (raw === 'smoke') return '연기';
  if (['knife', 'weapon', 'scissors', 'gun'].some(k => raw.includes(k))) return '흉기';
  if (['fall', 'fallen', 'tumble'].some(k => raw.includes(k)))           return '낙상';
  if (['person', 'people', 'human'].some(k => raw.includes(k)))          return '사람';
  if (raw === 'danger') return '위험';
  return raw || '알 수 없음';
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
