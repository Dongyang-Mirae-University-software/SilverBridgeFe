import classNames from 'classnames/bind';

import type { DetectState, LiveStreamAnalysis, LiveStreamSession, LiveStreamStatus } from '@/service/interface/liveStream';
import { formatNumber, normalizeDetectedType } from './monitorUtils';
import styles from './GuardianMonitorContent.module.css';

const cx = classNames.bind(styles);

interface MonitorViewerProps {
  detectState: DetectState;
  frameSrc: string | null;
  latestAnalysis: LiveStreamAnalysis | null;
  latestFrameUrl: string | null;
  selectedId: string | null;
  selectedSession?: LiveStreamSession;
  sessionStatus: LiveStreamStatus | null;
  viewerUrl: string | null;
}

export function MonitorViewer({
  detectState,
  frameSrc,
  latestAnalysis,
  latestFrameUrl,
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
      <MonitorHeader selectedId={selectedId} selectedSession={selectedSession} sessionStatus={sessionStatus} />
      <div className={cx('monitorGrid')}>
        <FrameViewer frameSrc={frameSrc} latestFrameUrl={latestFrameUrl} selectedId={selectedId} viewerUrl={viewerUrl} />
        <SessionMeta detectState={detectState} latestAnalysis={latestAnalysis} sessionStatus={sessionStatus} />
      </div>
    </div>
  );
}

function MonitorHeader({
  selectedId,
  selectedSession,
  sessionStatus,
}: {
  selectedId: string;
  selectedSession?: LiveStreamSession;
  sessionStatus: LiveStreamStatus | null;
}) {
  return (
    <div className={cx('viewerHeader')}>
      <div>
        <strong>{selectedSession?.ward_name ?? '피보호자'}</strong>
        <span>{selectedId}</span>
      </div>
      <div className={cx('statusRow')}>
        <span>status {sessionStatus?.status ?? '-'}</span>
        <span>FPS {formatNumber(sessionStatus?.fps)}</span>
        <span>시청자 {formatNumber(sessionStatus?.viewerCount ?? sessionStatus?.viewer_count)}명</span>
        {(sessionStatus?.isAnalyzing ?? sessionStatus?.is_analyzing) && <span className={cx('analyzingBadge')}>AI 분석 중</span>}
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
        <span>화재·연기</span>
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

function DetectionResult({ analysis, detectState }: { analysis: LiveStreamAnalysis; detectState: DetectState }) {
  const confidence = analysis.confidence ?? 0;
  const detectedType = normalizeDetectedType(analysis);

  if (detectState === 'fire' || detectState === 'smoke') {
    return (
      <div className={cx('detectCard')}>
        <strong>{detectedType} 감지됨</strong>
        <span>신뢰도 {confidence.toFixed(2)}</span>
        <small>표시 전용 · 응급 연락은 추후 연동 예정</small>
      </div>
    );
  }

  if (detectState === 'danger') {
    return (
      <div className={cx('dangerCard')}>
        <strong>위험 감지됨</strong>
        <span>신뢰도 {confidence.toFixed(2)}</span>
      </div>
    );
  }

  return (
    <div className={cx('safeCard')}>
      <strong>화재·연기: 미감지</strong>
      <span>신뢰도 {confidence.toFixed(2)}</span>
    </div>
  );
}
