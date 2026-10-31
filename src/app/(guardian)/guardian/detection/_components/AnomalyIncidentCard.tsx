'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { AnomalyIncident } from '@/service/interface/guardian/anomaly';
import { AnomalyClipModal } from './AnomalyClipModal';
import { AnomalyVerdictPanel } from './AnomalyVerdictPanel';
import { formatClipDuration, formatIncidentDate } from './anomalyFormat';
import { useClipThumbnail } from './clipThumbnail';
import styles from './AnomalyIncidentCard.module.css';

const cx = classNames.bind(styles);

// 이력 목록의 한 줄 = 상황(incident) 하나. 썸네일을 누르면 영상 화면이 열린다
export function AnomalyIncidentCard({ incident }: { incident: AnomalyIncident }) {
  const [isClipModalOpen, setIsClipModalOpen] = useState(false);
  const { src: thumbSrc, attach: attachThumb } = useClipThumbnail(incident.clip?.clipId);
  const duration = formatClipDuration(incident.clip?.durationMs);

  return (
    <li className={cx('row')}>
      <button
        type="button"
        ref={attachThumb}
        className={cx('thumbnail')}
        disabled={!incident.clip}
        aria-label={incident.clip ? '영상 보기' : '영상 없음'}
        onClick={() => setIsClipModalOpen(true)}
      >
        {/* 클립의 첫 화면. 못 받으면 어두운 배경 그대로 */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 인증이 필요한 클립 썸네일(BFF 경유)이라 next/image 최적화 대상이 아니다 */}
        {thumbSrc && incident.clip && <img className={cx('thumbImage')} src={thumbSrc} alt="" />}
        {incident.clip ? (
          <span className={cx('playButton')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--sb-brand)" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        ) : (
          <span className={cx('noClip')}>영상 없음</span>
        )}
        {duration && <span className={cx('durationBadge')}>{duration}</span>}
      </button>

      <div className={cx('body')}>
        <div className={cx('bodyHead')}>
          <span className={cx('typeBadge', incident.detectedType.toLowerCase())}>{incident.detectedTypeLabel}</span>
          <strong className={cx('location', { deleted: incident.cameraLabel === null })}>
            {incident.cameraLabel ?? '삭제된 카메라'}
          </strong>
        </div>
        <span className={cx('time')}>{formatIncidentDate(incident.startedAt)}</span>
        {incident.clipCount > 1 && <span className={cx('clipCount')}>영상 {incident.clipCount}개</span>}
      </div>

      <div className={cx('verdict')}>
        <AnomalyVerdictPanel incident={incident} />
      </div>

      {isClipModalOpen && <AnomalyClipModal incident={incident} onClose={() => setIsClipModalOpen(false)} />}
    </li>
  );
}
