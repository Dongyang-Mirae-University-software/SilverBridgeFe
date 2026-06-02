import classNames from 'classnames/bind';

import type { DetectState, LiveStreamAnalysis, LiveStreamSession, LiveStreamStatus } from '@/service/interface/liveStream';
import { formatNumber, normalizeDetectedType } from './monitorUtils';
import styles from './GuardianMonitorContent.module.css';

const cx = classNames.bind(styles);

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
      <div className={cx('viewerPanel')}>
        <div className={cx('emptyState')}>
          <p>좌측에서 세션을 선택하면<br />실시간 화면을 볼 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cx('viewerPanel')}>
      <MonitorHeader
        isStoppingSession={isStoppingSession}
        onStopSession={onStopSession}
        selectedId={selectedId}
        selectedSession={selectedSession}
        sessionStatus={sessionStatus}
      />
      <div className={cx('monitorGrid')}>
        <FrameViewer frameSrc={frameSrc} latestFrameUrl={latestFrameUrl} selectedId={selectedId} viewerUrl={viewerUrl} />
        <SessionMeta detectState={detectState} latestAnalysis={latestAnalysis} sessionStatus={sessionStatus} />
      </div>
    </div>
  );
}

function MonitorHeader({
  isStoppingSession,
  onStopSession,
  selectedId,
  selectedSession,
  sessionStatus,
}: {
  isStoppingSession: boolean;
  onStopSession: () => void;
  selectedId: string;
  selectedSession?: LiveStreamSession;
  sessionStatus: LiveStreamStatus | null;
}) {
  const isStopped = sessionStatus?.status === 'stopped';

  return (
    <div className={cx('viewerHeader')}>
      <div>
        <strong>{selectedSession?.ward_name ?? '피보호자'}</strong>
        <span>{selectedId}</span>
      </div>
      <div className={cx('viewerActions')}>
        <div className={cx('statusRow')}>
          <span>status {sessionStatus?.status ?? '-'}</span>
          <span>FPS {formatNumber(sessionStatus?.fps)}</span>
          <span>시청자 {formatNumber(sessionStatus?.viewerCount ?? sessionStatus?.viewer_count)}명</span>
          {(sessionStatus?.isAnalyzing ?? sessionStatus?.is_analyzing) && <span className={cx('analyzingBadge')}>AI 분석 중</span>}
        </div>
        <button
          type="button"
          className={cx('stopStreamButton')}
          disabled={isStoppingSession || isStopped}
          onClick={onStopSession}
        >
          {isStoppingSession ? '종료 중' : isStopped ? '종료됨' : '송출 종료'}
        </button>
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
    <section className={cx('viewerCard')}>
      <div className={cx('cardHeader')}>
        <h3>실시간 화면</h3>
        <span>WebSocket 이벤트 기반</span>
      </div>
      <div className={cx('frameWrapper')}>
        {frameSrc ? (
          <img key={latestFrameUrl ?? selectedId} src={frameSrc} alt="실시간 영상" className={cx('mjpegImg')} />
        ) : (
          <div className={cx('placeholder')}>프레임이 아직 수신되지 않았습니다.</div>
        )}
      </div>
      <p className={cx('hint')}>MJPEG URL: {viewerUrl ?? '-'}</p>
    </section>
  );
}

function SessionMeta({
  detectState,
  latestAnalysis,
  sessionStatus,
}: {
  detectState: DetectState;
  latestAnalysis: LiveStreamAnalysis | null;
  sessionStatus: LiveStreamStatus | null;
}) {
  return (
    <aside className={cx('metaCard')}>
      <div className={cx('cardHeader')}>
        <h3>세션 상태</h3>
      </div>
      <dl className={cx('metaList')}>
        <MetaItem label="status" value={sessionStatus?.status ?? '-'} />
        <MetaItem label="lastFrameAt" value={sessionStatus?.lastFrameAt ?? sessionStatus?.last_frame_at ?? '-'} />
        <MetaItem label="fps" value={formatNumber(sessionStatus?.fps)} />
        <MetaItem label="viewerCount" value={formatNumber(sessionStatus?.viewerCount ?? sessionStatus?.viewer_count)} />
        <MetaItem label="isAnalyzing" value={String(sessionStatus?.isAnalyzing ?? sessionStatus?.is_analyzing ?? false)} />
      </dl>

      <div className={cx('cardHeader', 'analysisHeader')}>
        <h3>최신 감지 결과</h3>
        <span>AI 분석</span>
      </div>
      {latestAnalysis ? (
        <DetectionResult analysis={latestAnalysis} detectState={detectState} />
      ) : (
        <p className={cx('metaMessage')}>분석 결과 대기 중입니다. 프레임이 수신되면 표시됩니다.</p>
      )}
    </aside>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
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
  const isDanger = ['fall', 'person', 'danger'].includes(detectState);
  const isSafe   = detectState === 'safe';

  return (
    <div className={cx(
      isSafe ? 'safeCard' : isAlert ? 'detectCard' : 'dangerCard'
    )}>
      <strong>{label}</strong>
      {!isSafe && <span>{detectedType} · 신뢰도 {Math.round(confidence * 100)}%</span>}
      {isSafe && <span>신뢰도 {Math.round(confidence * 100)}%</span>}
    </div>
  );
}
