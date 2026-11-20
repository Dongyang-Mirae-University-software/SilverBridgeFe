'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { guardianAnomalyClipsQueryOptions } from '@/service/query/guardian/anomaly';
import { AnomalyClip, AnomalyClipFileError, AnomalyIncident } from '@/service/interface/guardian/anomaly';
import { AnomalyVerdictPanel } from './AnomalyVerdictPanel';
import { formatClipDuration, formatIncidentDate, formatIncidentTime } from './anomalyFormat';
import { forgetClipFile, loadClipFile, stopClipProgress } from './clipFileCache';
import styles from './AnomalyClipModal.module.css';

const cx = classNames.bind(styles);

// 오탐으로 판정된 상황의 클립은 숨겨졌다가 24시간 뒤 지워진다 - 서버는 이유를 가리지 않고 404로 답한다
export const CLIP_UNAVAILABLE_MESSAGE = '볼 수 없는 영상이에요. 오탐으로 판정된 영상은 24시간 뒤 지워져요.';

const NO_CLIPS: AnomalyClip[] = [];

interface Playback {
  clipId: number;
  url: string;
}

// 클립 파일은 인증 헤더가 필요해 fetch로 받아 blob URL로 재생한다(URL에 토큰을 넣지 않는다).
// 영상은 메모리에만 두고, 다른 클립으로 바꾸거나 닫으면 blob URL을 해제한다. 다운로드는 두지 않는다.
// clipId를 주면 그 장면 하나만 연다(이력 목록의 장면 줄) - 영상 고르기 칩을 숨기고 날짜도 그 장면 시각으로 보인다
export function AnomalyClipModal({
  incident,
  clipId: sceneClipId,
  onClose,
}: {
  incident: AnomalyIncident;
  clipId?: number;
  onClose: () => void;
}) {
  const incidentId = incident.incidentId;
  const { data: clipsData, isLoading, isError } = useQuery(guardianAnomalyClipsQueryOptions(incidentId));
  const clips = clipsData ?? NO_CLIPS;
  const [playback, setPlayback] = useState<Playback | null>(null);
  // 누른 즉시 "선택됨"을 보이려는 상태 - playback은 fetch가 끝나야 채워진다
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [loadingClipId, setLoadingClipId] = useState<number | null>(null);
  const [clipErrors, setClipErrors] = useState<Record<number, string>>({});
  // 받은 바이트 수 - 퍼센트는 클립 목록의 sizeBytes 로 센다
  const [progress, setProgress] = useState<{ clipId: number; received: number } | null>(null);
  const playbackRef = useRef<Playback | null>(null);
  const didAutoSelectRef = useRef(false);
  const latestRequestRef = useRef<number | null>(null);
  const progressListenerRef = useRef<{ clipId: number; listener: (received: number) => void } | null>(null);

  // 닫을 때 마지막 재생 주소를 해제하려고 최신 값을 둔다(렌더 중 ref 대입 대신 커밋 뒤에)
  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  useEffect(() => {
    return () => {
      if (playbackRef.current) URL.revokeObjectURL(playbackRef.current.url);
      // 닫아도 받던 영상은 끝까지 받아 메모리에 둔다(다시 열면 바로 나온다) - 진행률 알림만 끊는다
      const progressListener = progressListenerRef.current;
      if (progressListener) stopClipProgress(progressListener.clipId, progressListener.listener);
      latestRequestRef.current = null;
    };
  }, []);

  const handleSelect = async (clipId: number) => {
    if (loadingClipId === clipId) return;
    setSelectedClipId(clipId);
    setClipErrors(current => {
      if (!(clipId in current)) return current;
      const next = { ...current };
      delete next[clipId];
      return next;
    });
    setLoadingClipId(clipId);
    latestRequestRef.current = clipId;
    setProgress({ clipId, received: 0 });

    const onProgress = (received: number) => setProgress({ clipId, received });
    progressListenerRef.current = { clipId, listener: onProgress };
    try {
      const blob = await loadClipFile(clipId, onProgress);
      // 받는 사이 다른 영상을 골랐으면 늦게 끝난 이 영상으로 바꾸지 않는다(받은 영상은 메모리에 남아 다시 고르면 바로 나온다)
      if (latestRequestRef.current !== clipId) return;
      setPlayback(current => {
        if (current) URL.revokeObjectURL(current.url);
        return { clipId, url: URL.createObjectURL(blob) };
      });
    } catch (error) {
      if (latestRequestRef.current !== clipId) return;
      const { status, message } = error as AnomalyClipFileError;
      // 403(연결되지 않은 피보호자)은 서버 문구를 그대로, 404는 볼 수 없는 영상 안내
      const text = status === 404 ? CLIP_UNAVAILABLE_MESSAGE : message ?? '영상을 불러오지 못했어요. 다시 시도해 주세요.';
      setClipErrors(current => ({ ...current, [clipId]: text }));
      setPlayback(current => {
        if (current) URL.revokeObjectURL(current.url);
        return null;
      });
    } finally {
      stopClipProgress(clipId, onProgress);
      if (latestRequestRef.current === clipId) {
        setLoadingClipId(null);
        setProgress(null);
      }
    }
  };

  // 장면을 골라 열었으면 그 영상을 바로, 아니면 목록을 받은 뒤 최신 클립(첫 항목)을 재생한다
  useEffect(() => {
    if (didAutoSelectRef.current) return;
    const target = sceneClipId ?? clips[0]?.clipId;
    if (target === undefined) return;
    didAutoSelectRef.current = true;
    handleSelect(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, sceneClipId]);

  const sceneClip = sceneClipId === undefined ? undefined : clips.find(clip => clip.clipId === sceneClipId);

  const selectedError = selectedClipId !== null ? clipErrors[selectedClipId] : undefined;
  // 목록을 다시 받았는데 재생 중이던 클립이 빠졌으면(이 화면에서 '괜찮아요'를 골라 숨겨짐) 받아 둔 영상도 내린다.
  // blob은 닫거나 다른 클립을 고를 때 해제된다
  const isPlaybackHidden = Boolean(playback && clipsData && !clipsData.some(clip => clip.clipId === playback.clipId));
  const hiddenClipId = isPlaybackHidden ? playback?.clipId : undefined;
  useEffect(() => {
    if (hiddenClipId !== undefined) forgetClipFile(hiddenClipId);
  }, [hiddenClipId]);

  const progressPercent = (clipId: number) => {
    if (progress?.clipId !== clipId) return null;
    const total = clips.find(clip => clip.clipId === clipId)?.sizeBytes;
    if (!total || total <= 0) return null;
    return Math.min(99, Math.floor((progress.received / total) * 100));
  };
  const loadingLabel = (clipId: number) => {
    const percent = progressPercent(clipId);
    return percent === null ? '불러오는 중' : `불러오는 중 ${percent}%`;
  };
  const loadingMessage =
    loadingClipId !== null && progressPercent(loadingClipId) !== null
      ? `영상을 불러오는 중이에요. ${progressPercent(loadingClipId)}%`
      : '영상을 불러오는 중이에요.';
  const videoMessage = isError
    ? '영상 목록을 불러오지 못했어요.'
    : isPlaybackHidden
      ? CLIP_UNAVAILABLE_MESSAGE
      : !isLoading && clips.length === 0
      ? '볼 수 있는 영상이 없어요.'
      : selectedError ?? loadingMessage;

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <div className={cx('modal')} role="dialog" aria-modal="true" aria-label="감지 영상" onClick={event => event.stopPropagation()}>
        <header className={cx('header')}>
          <div className={cx('headerTitle')}>
            <span className={cx('typeBadge', incident.detectedType.toLowerCase())}>{incident.detectedTypeLabel} 감지</span>
            <strong className={cx('location', { deleted: incident.cameraLabel === null })}>
              {incident.cameraLabel ?? '삭제된 카메라'}
            </strong>
          </div>
          <button type="button" className={cx('closeButton')} onClick={onClose} aria-label="닫기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className={cx('videoArea')}>
          {playback && !selectedError && !isPlaybackHidden ? (
            <video key={playback.clipId} src={playback.url} controls playsInline autoPlay className={cx('video')} />
          ) : (
            <div className={cx('placeholder', { error: Boolean(selectedError) })}>{videoMessage}</div>
          )}
        </div>

        <div className={cx('info')}>
          <span className={cx('date')}>{formatIncidentDate(sceneClip?.detectedAt ?? incident.startedAt)}</span>

          {sceneClipId === undefined && clips.length > 1 && (
            <div className={cx('clipChips')} role="group" aria-label="영상 선택">
              {clips.map((clip, index) => {
                const duration = formatClipDuration(clip.durationMs);
                const isSelected = selectedClipId === clip.clipId;
                return (
                  <button
                    key={clip.clipId}
                    type="button"
                    className={cx('clipChip', { active: isSelected, failed: Boolean(clipErrors[clip.clipId]) })}
                    aria-pressed={isSelected}
                    onClick={() => handleSelect(clip.clipId)}
                  >
                    영상 {index + 1}
                    <span className={cx('clipChipMeta')}>
                      {loadingClipId === clip.clipId ? loadingLabel(clip.clipId) : formatIncidentTime(clip.detectedAt)}
                      {duration ? ` · ${duration}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className={cx('verdictBox')}>
            <AnomalyVerdictPanel incident={incident} size="big" prompt="영상을 보고 알려 주세요" />
          </div>
        </div>
      </div>
    </div>
  );
}
