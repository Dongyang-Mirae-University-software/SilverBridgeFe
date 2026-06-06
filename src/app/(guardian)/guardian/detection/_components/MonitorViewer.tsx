import clsx from 'clsx';

import type { DetectState, LiveStreamAnalysis, LiveStreamSession, LiveStreamStatus } from '@/service/interface/liveStream';
import { formatDateTime, formatNumber, formatRelativeDateTime, normalizeDetectedType } from './monitorUtils';
import styles from './MonitorViewer.module.css';


interface MonitorViewerProps {
  detectState: DetectState;
  frameSrc: string | null;
  isStoppingSession: boolean;
  latestAnalysis: LiveStreamAnalysis | null;
  latestFrameUrl: string | null;
  onStopSession: () => void;
  selectedId: string | null;
  selectedSession?: LiveStreamSession;
  sessionStatus: LiveStreamStatus | null;
  viewerUrl: string | null;
}

export function MonitorViewer({
  detectState,
  frameSrc,
  isStoppingSession,
  latestAnalysis,
  latestFrameUrl,
  onStopSession,
  selectedId,
  selectedSession,
  sessionStatus,
  viewerUrl,
}: MonitorViewerProps) {
  if (!selectedId) {
    return (
      <div className={styles.viewerPanel}>
        <div className={styles.emptyState}>
          <p>상단에서 세션을 선택하면<br />실시간 화면을 볼 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.viewerPanel}>
      <div className={styles.monitorGrid}>
        <FrameViewer frameSrc={frameSrc} latestFrameUrl={latestFrameUrl} selectedId={selectedId} viewerUrl={viewerUrl} />
        <SessionMeta
          detectState={detectState}
          isStoppingSession={isStoppingSession}
          latestAnalysis={latestAnalysis}
          onStopSession={onStopSession}
          selectedId={selectedId}
          selectedSession={selectedSession}
          sessionStatus={sessionStatus}
        />
      </div>
    </div>
  );
}

function FrameViewer({
  frameSrc,
  latestFrameUrl,
  selectedId,
  viewerUrl,
}: {
  frameSrc: string | null;
  latestFrameUrl: string | null;
  selectedId: string;
  viewerUrl: string | null;
}) {
  return (
    <section className={styles.viewerCard}>
      <div className={styles.cardHeader}>
        <h3>실시간 화면</h3>
        <span>WebSocket 이벤트 기반</span>
      </div>
      <div className={styles.frameWrapper}>
        {frameSrc ? (
          <img key={latestFrameUrl ?? selectedId} src={frameSrc} alt="실시간 영상" className={styles.mjpegImg} />
        ) : (
          <div className={styles.placeholder}>프레임이 아직 수신되지 않았습니다.</div>
        )}
      </div>
      <p className={styles.hint}>MJPEG URL: {viewerUrl ?? '-'}</p>
    </section>
  );
}

function SessionMeta({
  detectState,
  isStoppingSession,
  latestAnalysis,
  onStopSession,
  selectedId,
  selectedSession,
  sessionStatus,
}: {
  detectState: DetectState;
  isStoppingSession: boolean;
  latestAnalysis: LiveStreamAnalysis | null;
  onStopSession: () => void;
  selectedId: string;
  selectedSession?: LiveStreamSession;
  sessionStatus: LiveStreamStatus | null;
}) {
  const isStopped = sessionStatus?.status === 'stopped';

  return (
    <aside className={styles.metaCard}>
      <div className={styles.metaSummary}>
        <div className={styles.metaIdentity}>
          <span>피보호자</span>
          <strong>{selectedSession?.ward_name ?? '피보호자'}</strong>
          <small>{selectedId}</small>
          <em>{formatDateTime(selectedSession?.started_at ?? sessionStatus?.started_at)}</em>
        </div>
        <button
          type="button"
          className={styles.stopStreamButton}
          disabled={isStoppingSession || isStopped}
          onClick={onStopSession}
        >
          {isStoppingSession ? '종료 중' : isStopped ? '종료됨' : '송출 종료'}
        </button>
      </div>

      <div className={clsx(styles.statusRow, styles.metaStatusRow)}>
        <span>status {sessionStatus?.status ?? '-'}</span>
        <span>FPS {formatNumber(sessionStatus?.fps)}</span>
        <span>시청자 {formatNumber(sessionStatus?.viewerCount ?? sessionStatus?.viewer_count)}명</span>
        {(sessionStatus?.isAnalyzing ?? sessionStatus?.is_analyzing) && <span className={styles.analyzingBadge}>AI 분석 중</span>}
      </div>

      <dl className={styles.metaList}>
        <MetaItem
          label="lastFrameAt"
          value={formatDateTime(sessionStatus?.lastFrameAt ?? sessionStatus?.last_frame_at)}
          subValue={formatRelativeDateTime(sessionStatus?.lastFrameAt ?? sessionStatus?.last_frame_at)}
        />
        <MetaItem label="isAnalyzing" value={String(sessionStatus?.isAnalyzing ?? sessionStatus?.is_analyzing ?? false)} />
      </dl>

      <div className={clsx(styles.cardHeader, styles.analysisHeader)}>
        <h3>최신 감지 결과</h3>
        <span>AI 분석</span>
      </div>
      {latestAnalysis ? (
        <DetectionResult analysis={latestAnalysis} detectState={detectState} />
      ) : (
        <p className={styles.metaMessage}>분석 결과 대기 중입니다. 프레임이 수신되면 표시됩니다.</p>
      )}
    </aside>
  );
}

function MetaItem({ label, subValue, value }: { label: string; subValue?: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        {subValue && subValue !== '-' && <small>{subValue}</small>}
      </dd>
    </div>
  );
}

const DETECT_LABEL: Record<DetectState, string> = {
  fire:   '화재 감지됨',
  smoke:  '연기 감지됨',
  knife:  '흉기 발견',
  fall:   '낙상 감지됨',
  person: '사람 감지됨',
  danger: '위험 감지됨',
  safe:   '이상 없음',
};

function DetectionResult({ analysis, detectState }: { analysis: LiveStreamAnalysis; detectState: DetectState }) {
  const confidence = analysis.confidence ?? 0;
  const detectedType = normalizeDetectedType(analysis);
  const label = DETECT_LABEL[detectState];

  const isAlert  = ['fire', 'smoke', 'knife'].includes(detectState);
  const isSafe   = detectState === 'safe';

  return (
    <div className={styles[isSafe ? 'safeCard' : isAlert ? 'detectCard' : 'dangerCard']}>
      <strong>{label}</strong>
      {!isSafe && <span>{detectedType} · 신뢰도 {Math.round(confidence * 100)}%</span>}
      {isSafe && <span>신뢰도 {Math.round(confidence * 100)}%</span>}
      {analysis.detected_at && <small>{formatDateTime(analysis.detected_at)}</small>}
    </div>
  );
}
