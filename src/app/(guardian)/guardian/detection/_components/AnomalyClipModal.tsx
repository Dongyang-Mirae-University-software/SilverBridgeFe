'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { fetchGuardianAnomalyClipFile } from '@/service/api/guardian/anomaly';
import { guardianAnomalyClipsQueryOptions } from '@/service/query/guardian/anomaly';
import { AnomalyClipFileError, AnomalyIncident } from '@/service/interface/guardian/anomaly';
import { formatDateTime } from '@/utils/format/date';
import styles from './AnomalyClipModal.module.css';

const cx = classNames.bind(styles);

interface Playback {
  clipId: number;
  url: string;
}

function formatDuration(durationMs: number | null) {
  if (!durationMs) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function AnomalyClipModal({ incident, onClose }: { incident: AnomalyIncident; onClose: () => void }) {
  const incidentId = incident.incidentId;
  const { data: clips = [], isLoading, isError } = useQuery(guardianAnomalyClipsQueryOptions(incidentId));
  const [playback, setPlayback] = useState<Playback | null>(null);
  // 클립을 누른 즉시 "선택됨" 표시를 띄우기 위한 상태 — playback은 fetch가 끝나야 채워지므로
  // 이게 없으면 로딩 중에는 아무것도 선택 안 한 것처럼 보임
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [loadingClipId, setLoadingClipId] = useState<number | null>(null);
  const [clipErrors, setClipErrors] = useState<Record<number, { message: string; unavailable: boolean }>>({});
  const playbackRef = useRef<Playback | null>(null);
  playbackRef.current = playback;
  const didAutoSelectRef = useRef(false);

  // 모달을 닫거나 다른 클립으로 전환할 때 blob URL을 해제해야 메모리가 안 쌓임
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
      const { code, message } = error as AnomalyClipFileError;
      const unavailable = code === 'ANOMALY_CLIP_NOT_FOUND';
      setClipErrors(current => ({
        ...current,
        [clipId]: { message: unavailable ? '영상을 볼 수 없습니다.' : message ?? '영상을 불러오지 못했습니다.', unavailable },
      }));
    } finally {
      setLoadingClipId(null);
    }
  };

  // 목록을 불러오면 모달이 비어 보이지 않도록 최신 클립(첫 항목)을 자동으로 선택·재생
  useEffect(() => {
    if (didAutoSelectRef.current || clips.length === 0) return;
    didAutoSelectRef.current = true;
    handleSelect(clips[0].clipId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips]);

  const duration = formatDuration(playback ? (clips.find(clip => clip.clipId === playback.clipId)?.durationMs ?? null) : null);

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <div className={cx('modal')} role="dialog" aria-modal="true" aria-label="감지 영상" onClick={event => event.stopPropagation()}>
        <div className={cx('videoArea')}>
          <span className={cx('recBadge')}>● REC · {formatDateTime(incident.startedAt)}</span>
          {playback ? (
            <video key={playback.clipId} src={playback.url} controls playsInline autoPlay className={cx('video')} />
          ) : (
            <div className={cx('placeholder')}>영상을 불러오는 중입니다...</div>
          )}
        </div>

        <div className={cx('infoRow')}>
          <strong>
            {incident.detectedTypeLabel} 감지 · {incident.cameraLabel ?? '삭제된 카메라'}
          </strong>
          <span>
            {formatDateTime(incident.startedAt)}
            {duration ? ` · 영상 ${duration}` : ''}
          </span>
        </div>

        <div className={cx('footerActions')}>
          <a
            className={cx('downloadButton', { disabled: !playback })}
            href={playback?.url}
            download={playback ? `anomaly-${playback.clipId}.mp4` : undefined}
            aria-disabled={!playback}
            onClick={event => {
              if (!playback) event.preventDefault();
            }}
          >
            다운로드
          </a>
          <button type="button" className={cx('closeAction')} onClick={onClose}>
            닫기
          </button>
        </div>

        {isLoading && <p className={cx('status')}>영상 목록을 불러오는 중입니다.</p>}
        {isError && <p className={cx('status')}>영상 목록을 불러오지 못했습니다.</p>}
        {!isLoading && !isError && clips.length === 0 && <p className={cx('status')}>표시할 영상이 없습니다.</p>}

        <ul className={cx('list')}>
          {clips.map(clip => {
            const clipError = clipErrors[clip.clipId];
            const isSelected = selectedClipId === clip.clipId;
            const isUnavailable = Boolean(clipError?.unavailable);

            return (
              <li
                key={clip.clipId}
                className={cx('item', { active: isSelected, disabled: isUnavailable })}
                role="button"
                tabIndex={isUnavailable ? -1 : 0}
                aria-disabled={isUnavailable}
                aria-pressed={isSelected}
                onClick={() => !isUnavailable && handleSelect(clip.clipId)}
                onKeyDown={event => {
                  if (isUnavailable) return;
                  if (event.key === 'Enter' || event.key === ' ') handleSelect(clip.clipId);
                }}
              >
                <div className={cx('itemInfo')}>
                  <span>{formatDateTime(clip.detectedAt)}</span>
                  {clipError && <span className={cx('itemError')}>{clipError.message}</span>}
                </div>
                {!isUnavailable && (
                  <span className={cx('playIndicator')}>
                    {loadingClipId === clip.clipId ? '불러오는 중' : isSelected ? '선택됨' : '▶ 재생'}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
