'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { guardianAnomalyClipsQueryOptions } from '@/service/query/guardian/anomaly';
import { AnomalyClip, AnomalyIncident } from '@/service/interface/guardian/anomaly';
import { AnomalyClipModal } from './AnomalyClipModal';
import { AnomalyVerdictPanel } from './AnomalyVerdictPanel';
import { formatClipDuration, formatIncidentDate } from './anomalyFormat';
import { useClipThumbnail } from './clipThumbnail';
import styles from './AnomalyIncidentCard.module.css';

const cx = classNames.bind(styles);

// 이력 목록은 장면(영상) 하나당 한 줄이다. 영상이 여러 개인 상황은 영상 목록을 받아 장면마다 줄을 나누고,
// 판정은 상황 단위(BE)라 같은 상황의 줄은 같은 판정을 함께 보여 준다. 목록을 받기 전·실패 시에는 대표 영상 한 줄로 둔다
export function AnomalyIncidentCard({ incident }: { incident: AnomalyIncident }) {
  const hasManyClips = incident.clipCount > 1;
  const { data: clips } = useQuery({ ...guardianAnomalyClipsQueryOptions(incident.incidentId), enabled: hasManyClips });
  const scenes: (AnomalyClip | null)[] = hasManyClips && clips && clips.length > 0 ? clips : [incident.clip];

  return (
    <>
      {scenes.map((clip, index) => (
        <AnomalySceneRow
          key={clip?.clipId ?? `incident-${incident.incidentId}`}
          incident={incident}
          clip={clip}
          sceneNumber={scenes.length - index}
          sceneTotal={scenes.length}
        />
      ))}
    </>
  );
}

interface SceneRowProps {
  incident: AnomalyIncident;
  clip: AnomalyClip | null;
  sceneNumber: number; // 시간순 번호(1 = 처음 장면). 영상 목록은 최신순이라 뒤에서 센다
  sceneTotal: number;
}

function AnomalySceneRow({ incident, clip, sceneNumber, sceneTotal }: SceneRowProps) {
  const [isClipModalOpen, setIsClipModalOpen] = useState(false);
  const { src: thumbSrc, attach: attachThumb } = useClipThumbnail(clip?.clipId);
  const duration = formatClipDuration(clip?.durationMs);
  const isScene = sceneTotal > 1;

  return (
    <li className={cx('row')}>
      <button
        type="button"
        ref={attachThumb}
        className={cx('thumbnail')}
        disabled={!clip}
        aria-label={clip ? '영상 보기' : '영상 없음'}
        onClick={() => setIsClipModalOpen(true)}
      >
        {/* 클립의 첫 화면. 못 받으면 어두운 배경 그대로 */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 인증이 필요한 클립 썸네일(BFF 경유)이라 next/image 최적화 대상이 아니다 */}
        {thumbSrc && clip && <img className={cx('thumbImage')} src={thumbSrc} alt="" />}
        {clip ? (
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
        <span className={cx('time')}>{formatIncidentDate(isScene && clip ? clip.detectedAt : incident.startedAt)}</span>
        {isScene ? (
          <span className={cx('clipCount')}>
            같은 상황의 장면 {sceneNumber}/{sceneTotal}
          </span>
        ) : (
          incident.clipCount > 1 && <span className={cx('clipCount')}>영상 {incident.clipCount}개</span>
        )}
      </div>

      <div className={cx('verdict')}>
        <AnomalyVerdictPanel incident={incident} />
      </div>

      {isClipModalOpen && (
        <AnomalyClipModal incident={incident} clipId={isScene ? clip?.clipId : undefined} onClose={() => setIsClipModalOpen(false)} />
      )}
    </li>
  );
}
