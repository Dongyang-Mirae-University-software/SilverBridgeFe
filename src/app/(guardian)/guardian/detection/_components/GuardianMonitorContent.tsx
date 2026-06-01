'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { getLiveStreamLatestAnalysis, getLiveStreamStatus, getLiveStreams } from '@/service/api/liveStream';
import { type LiveStreamServerEvent, connectLiveStreamSocket } from '@/lib/realtime/liveStreamSocket';
import type { LiveStreamAnalysis, LiveStreamSession, LiveStreamStatus } from '@/service/interface/liveStream';
import { resolveDetectState } from '@/service/interface/liveStream';

import styles from './GuardianMonitorContent.module.css';

const cx = classNames.bind(styles);

export default function GuardianMonitorContent() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const socketRef = useRef<ReturnType<typeof connectLiveStreamSocket> | null>(null);
  const [socketStatus, setSocketStatus] = useState<LiveStreamStatus | null>(null);
  const [socketAnalysis, setSocketAnalysis] = useState<LiveStreamAnalysis | null>(null);
  const [latestFrameUrl, setLatestFrameUrl] = useState<string | null>(null);

  const { data: sessions = [], isLoading, isError, error } = useQuery({
    queryKey: ['liveStreams'],
    queryFn: getLiveStreams,
    refetchInterval: 15_000,
  });

  const { data: status } = useQuery({
    queryKey: ['liveStreamStatus', selectedId],
    queryFn: () => getLiveStreamStatus(selectedId!),
    enabled: !!selectedId,
  });

  const { data: analysis } = useQuery({
    queryKey: ['liveStreamAnalysis', selectedId],
    queryFn: () => getLiveStreamLatestAnalysis(selectedId!),
    enabled: !!selectedId,
  });

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // WebSocket 연결 — live_streams/session_status/latest_analysis 이벤트를 화면에 즉시 반영
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_STREAM_WS_URL;
    if (!wsUrl) return;

    const socket = connectLiveStreamSocket({
      wsUrl,
      onEvent: (event: LiveStreamServerEvent) => {
        if (event.type === 'live_streams') {
          const nextSessions = normalizeSessions(event.data);
          if (nextSessions) queryClient.setQueryData(['liveStreams'], nextSessions);
          void queryClient.invalidateQueries({ queryKey: ['liveStreams'] });
        } else if (event.type === 'session_status') {
          const nextStatus = normalizeStatus(event.data);
          const sessionId = nextStatus?.session_id ?? selectedIdRef.current;
          if (nextStatus && sessionId) {
            setSocketStatus(nextStatus);
            queryClient.setQueryData(['liveStreamStatus', sessionId], nextStatus);
          }
          if (sessionId) void queryClient.invalidateQueries({ queryKey: ['liveStreamStatus', sessionId] });
        } else if (event.type === 'latest_analysis') {
          const nextAnalysis = normalizeAnalysis(event.data);
          const sessionId = getEventSessionId(event.data) ?? selectedIdRef.current;
          if (nextAnalysis && sessionId) {
            setSocketAnalysis(nextAnalysis);
            setLatestFrameUrl(getLatestFrameUrl(nextAnalysis));
            queryClient.setQueryData(['liveStreamAnalysis', sessionId], nextAnalysis);
          }
          if (sessionId) void queryClient.invalidateQueries({ queryKey: ['liveStreamAnalysis', sessionId] });
        }
      },
    });

    socketRef.current = socket;
    return () => socket.disconnect();
  }, [queryClient]);

  // 세션 선택 — selectedId 변경 + WS subscribe 액션 전송
  function handleSelectSession(sessionId: string) {
    setSelectedId(sessionId);
    selectedIdRef.current = sessionId;
    setSocketStatus(null);
    setSocketAnalysis(null);
    setLatestFrameUrl(null);
    socketRef.current?.subscribe(sessionId);
  }

  const selectedSession = sessions.find((s: LiveStreamSession) => s.session_id === selectedId);
  const sessionStatus = socketStatus ?? status ?? null;
  const latestAnalysis = socketAnalysis ?? analysis ?? null;
  const detectState = resolveDetectState(latestAnalysis);
  const mjpegSrc = selectedId ? `/api/streams/v1/live-streams/${selectedId}/mjpeg` : null;
  const viewerUrl = selectedSession?.viewerUrl ?? selectedSession?.viewer_url ?? mjpegSrc;
  const frameSrc = latestFrameUrl ?? mjpegSrc;

  return (
    <div className={cx('monitorPage')}>
      {/* 세션 목록 패널 */}
      <aside className={cx('sessionPanel')}>
        <div className={cx('sessionPanelHeader')}>
          <strong>송출 세션</strong>
          <span>{sessions.length}</span>
        </div>

        {isLoading ? (
          <p className={cx('sessionEmpty')}>불러오는 중…</p>
        ) : isError ? (
          <p className={cx('sessionEmpty')}>
            불러오기 실패
            <br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>{(error as Error)?.message}</span>
          </p>
        ) : sessions.length === 0 ? (
          <p className={cx('sessionEmpty')}>현재 송출 중인 세션이 없습니다.</p>
        ) : (
          <ul className={cx('sessionList')}>
            {sessions.map((session: LiveStreamSession) => (
              <li key={session.session_id}>
                <button
                  type="button"
                  className={cx('sessionCard', { active: selectedId === session.session_id })}
                  onClick={() => handleSelectSession(session.session_id)}
                >
                  <strong>{session.ward_name ?? '피보호자'}</strong>
                  <span className={cx('sessionId')}>{session.session_id.slice(0, 8)}…</span>
                  {session.is_analyzing && <span className={cx('analyzingBadge')}>AI 분석 중</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* 뷰어 패널 */}
      <div className={cx('viewerPanel')}>
        {!selectedId ? (
          <div className={cx('emptyState')}>
            <p>좌측에서 세션을 선택하면<br />실시간 화면을 볼 수 있습니다.</p>
          </div>
        ) : (
          <>
            {/* 세션 헤더 — 이름, 세션 ID, fps/시청자/분석 상태 */}
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

            <div className={cx('monitorGrid')}>
              <section className={cx('viewerCard')}>
                <div className={cx('cardHeader')}>
                  <h3>실시간 화면</h3>
                  <span>WebSocket 이벤트 기반</span>
                </div>
                <div className={cx('frameWrapper')}>
                  {frameSrc ? (
                    <img
                      key={latestFrameUrl ?? selectedId}
                      src={frameSrc}
                      alt="실시간 영상"
                      className={cx('mjpegImg')}
                    />
                  ) : (
                    <div className={cx('placeholder')}>프레임이 아직 수신되지 않았습니다.</div>
                  )}
                </div>
                <p className={cx('hint')}>MJPEG URL: {viewerUrl ?? '-'}</p>
              </section>

              <aside className={cx('metaCard')}>
                <div className={cx('cardHeader')}>
                  <h3>세션 상태</h3>
                </div>
                <dl className={cx('metaList')}>
                  <div>
                    <dt>status</dt>
                    <dd>{sessionStatus?.status ?? '-'}</dd>
                  </div>
                  <div>
                    <dt>lastFrameAt</dt>
                    <dd>{sessionStatus?.lastFrameAt ?? sessionStatus?.last_frame_at ?? '-'}</dd>
                  </div>
                  <div>
                    <dt>fps</dt>
                    <dd>{formatNumber(sessionStatus?.fps)}</dd>
                  </div>
                  <div>
                    <dt>viewerCount</dt>
                    <dd>{formatNumber(sessionStatus?.viewerCount ?? sessionStatus?.viewer_count)}</dd>
                  </div>
                  <div>
                    <dt>isAnalyzing</dt>
                    <dd>{String(sessionStatus?.isAnalyzing ?? sessionStatus?.is_analyzing ?? false)}</dd>
                  </div>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetectionResult({ analysis, detectState }: { analysis: LiveStreamAnalysis; detectState: ReturnType<typeof resolveDetectState> }) {
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

function normalizeSessions(data: unknown) {
  if (!Array.isArray(data)) return null;

  return data.map(item => {
    const session = item as Record<string, unknown>;

    return {
      ...session,
      session_id: String(session.session_id ?? session.sessionId ?? session.id ?? ''),
      viewerUrl: typeof session.viewerUrl === 'string' ? session.viewerUrl : undefined,
      viewer_url: typeof session.viewer_url === 'string' ? session.viewer_url : undefined,
    } as LiveStreamSession;
  });
}

function normalizeStatus(data: unknown): LiveStreamStatus | null {
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

function normalizeAnalysis(data: unknown): LiveStreamAnalysis | null {
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

function getEventSessionId(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;

  return getString(raw.session_id) ?? getString(raw.sessionId);
}

function getLatestFrameUrl(analysis: LiveStreamAnalysis) {
  return analysis.latestFrameUrl ?? analysis.latest_frame_url ?? analysis.frameUrl ?? analysis.frame_url ?? analysis.imageUrl ?? analysis.image_url ?? null;
}

function normalizeDetectedType(analysis: LiveStreamAnalysis) {
  const rawType = analysis.detectedType ?? analysis.detected_type ?? analysis.label ?? analysis.class_name;

  if (rawType === 'fire') return '화재';
  if (rawType === 'smoke') return '연기';
  if (rawType === 'danger') return '위험';
  return '화재·연기';
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

function formatNumber(value: number | undefined) {
  return value == null ? '-' : String(value);
}
