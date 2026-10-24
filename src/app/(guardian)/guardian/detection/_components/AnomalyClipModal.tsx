'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { fetchGuardianAnomalyClipFile } from '@/service/api/guardian/anomaly';
import { guardianAnomalyClipsQueryOptions } from '@/service/query/guardian/anomaly';
import { AnomalyClip, AnomalyClipFileError, AnomalyIncident } from '@/service/interface/guardian/anomaly';
import { AnomalyVerdictPanel } from './AnomalyVerdictPanel';
import { formatClipDuration, formatIncidentDate, formatIncidentTime } from './anomalyFormat';
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
export function AnomalyClipModal({ incident, onClose }: { incident: AnomalyIncident; onClose: () => void }) {
  const incidentId = incident.incidentId;
  const { data: clipsData, isLoading, isError } = useQuery(guardianAnomalyClipsQueryOptions(incidentId));
  const clips = clipsData ?? NO_CLIPS;
  const [playback, setPlayback] = useState<Playback | null>(null);
  // 누른 즉시 "선택됨"을 보이려는 상태 - playback은 fetch가 끝나야 채워진다
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [loadingClipId, setLoadingClipId] = useState<number | null>(null);
  const [clipErrors, setClipErrors] = useState<Record<number, string>>({});
  const playbackRef = useRef<Playback | null>(null);
  playbackRef.current = playback;
  const didAutoSelectRef = useRef(false);

  useEffect(() => {
    return () => {
      if (playbackRef.current) URL.revokeObjectURL(playbackRef.current.url);
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

    try {
      const blob = await fetchGuardianAnomalyClipFile(clipId);
      setPlayback(current => {
        if (current) URL.revokeObjectURL(current.url);
        return { clipId, url: URL.createObjectURL(blob) };
      });
    } catch (error) {
      const { status, message } = error as AnomalyClipFileError;
      // 403(연결되지 않은 피보호자)은 서버 문구를 그대로, 404는 볼 수 없는 영상 안내
      const text = status === 404 ? CLIP_UNAVAILABLE_MESSAGE : message ?? '영상을 불러오지 못했어요. 다시 시도해 주세요.';
      setClipErrors(current => ({ ...current, [clipId]: text }));
      setPlayback(current => {
        if (current) URL.revokeObjectURL(current.url);
        return null;
      });
    } finally {
      setLoadingClipId(null);
    }
  };

  // 목록을 받으면 최신 클립(첫 항목)을 바로 재생한다
  useEffect(() => {
    if (didAutoSelectRef.current || clips.length === 0) return;
    didAutoSelectRef.current = true;
    handleSelect(clips[0].clipId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips]);

  const selectedError = selectedClipId !== null ? clipErrors[selectedClipId] : undefined;
  // 목록을 다시 받았는데 재생 중이던 클립이 빠졌으면(이 화면에서 '괜찮아요'를 골라 숨겨짐) 받아 둔 영상도 내린다.
  // blob은 닫거나 다른 클립을 고를 때 해제된다
  const isPlaybackHidden = Boolean(playback && clipsData && !clipsData.some(clip => clip.clipId === playback.clipId));
  const videoMessage = isError
    ? '영상 목록을 불러오지 못했어요.'
    : isPlaybackHidden
      ? CLIP_UNAVAILABLE_MESSAGE
      : !isLoading && clips.length === 0
      ? '볼 수 있는 영상이 없어요.'
      : selectedError ?? '영상을 불러오는 중이에요.';

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
          <span className={cx('date')}>{formatIncidentDate(incident.startedAt)}</span>

          {clips.length > 1 && (
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
                      {loadingClipId === clip.clipId ? '불러오는 중' : formatIncidentTime(clip.detectedAt)}
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
