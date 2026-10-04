'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { fetchGuardianAnomalyClipFile } from '@/service/api/guardian/anomaly';
import { guardianAnomalyClipsQueryOptions } from '@/service/query/guardian/anomaly';
import { AnomalyClipFileError } from '@/service/interface/guardian/anomaly';
import { formatDateTime } from '@/utils/format/date';
import styles from './AnomalyClipModal.module.css';

const cx = classNames.bind(styles);

interface Playback {
  clipId: number;
  url: string;
}

export function AnomalyClipModal({ incidentId, onClose }: { incidentId: number; onClose: () => void }) {
  const { data: clips = [], isLoading, isError } = useQuery(guardianAnomalyClipsQueryOptions(incidentId));
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [loadingClipId, setLoadingClipId] = useState<number | null>(null);
  const [clipErrors, setClipErrors] = useState<Record<number, { message: string; unavailable: boolean }>>({});
  const playbackRef = useRef<Playback | null>(null);
  playbackRef.current = playback;

  // 모달을 닫거나 다른 클립으로 전환할 때 blob URL을 해제해야 메모리가 안 쌓임
  useEffect(() => {
    return () => {
      if (playbackRef.current) URL.revokeObjectURL(playbackRef.current.url);
    };
  }, []);

  const handlePlay = async (clipId: number) => {
    if (loadingClipId === clipId) return;
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

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <div className={cx('modal')} role="dialog" aria-modal="true" aria-label="감지 영상" onClick={event => event.stopPropagation()}>
        <header className={cx('header')}>
          <strong>감지 영상</strong>
          <button type="button" className={cx('closeButton')} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={cx('videoArea')}>
          {playback ? (
            <video key={playback.clipId} src={playback.url} controls playsInline className={cx('video')} />
          ) : (
            <div className={cx('placeholder')}>재생할 영상을 선택하세요.</div>
          )}
        </div>

        {isLoading && <p className={cx('status')}>영상 목록을 불러오는 중입니다.</p>}
        {isError && <p className={cx('status')}>영상 목록을 불러오지 못했습니다.</p>}
        {!isLoading && !isError && clips.length === 0 && <p className={cx('status')}>표시할 영상이 없습니다.</p>}

        <ul className={cx('list')}>
          {clips.map(clip => {
            const clipError = clipErrors[clip.clipId];

            return (
              <li key={clip.clipId} className={cx('item', { active: playback?.clipId === clip.clipId })}>
                <div className={cx('itemInfo')}>
                  <span>{formatDateTime(clip.detectedAt)}</span>
                  {clipError && <span className={cx('itemError')}>{clipError.message}</span>}
                </div>
                {!clipError?.unavailable && (
                  <button
                    type="button"
                    className={cx('playButton')}
                    disabled={loadingClipId === clip.clipId}
                    onClick={() => handlePlay(clip.clipId)}
                  >
                    {loadingClipId === clip.clipId ? '불러오는 중' : '▶ 재생'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
