'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import classNames from 'classnames/bind';

import { formatDateTime } from '@/utils/format/date';
import { AnomalyIncident, AnomalyVerdict } from '@/service/interface/guardian/anomaly';
import { useAnomalyFeedbackMutation } from '@/service/query/guardian/anomaly';
import { showToast } from '@/store/toastStore';
import { AnomalyClipModal } from './AnomalyClipModal';
import styles from './AnomalyIncidentCard.module.css';

const cx = classNames.bind(styles);

const REVIEW_STATUS_LABEL: Record<AnomalyIncident['reviewStatus'], string> = {
  PENDING: '확인 필요',
  REAL: '실제 위험',
  FALSE_ALARM: '오탐',
  CONFLICTED: '응답 엇갈림 · 재확인 필요',
};

const TYPE_META: Record<AnomalyIncident['detectedType'], { icon: string }> = {
  FIRE: { icon: '🔥' },
  SMOKE: { icon: '💨' },
};

function formatDuration(durationMs: number | null) {
  if (!durationMs) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function AnomalyIncidentCard({ incident }: { incident: AnomalyIncident }) {
  const feedbackMutation = useAnomalyFeedbackMutation();
  const [isClipModalOpen, setIsClipModalOpen] = useState(false);

  const handleFeedback = (verdict: AnomalyVerdict) => {
    if (feedbackMutation.isPending) return;
    feedbackMutation.mutate(
      { incidentId: incident.incidentId, body: { verdict } },
      {
        onError: error => {
          const message = (error as { message?: string })?.message ?? '응답을 보내지 못했습니다. 다시 시도해 주세요.';
          showToast(message, { variant: 'error' });
        },
      },
    );
  };

  const canRespond = incident.reviewStatus === 'PENDING' || incident.reviewStatus === 'CONFLICTED';
  const typeMeta = TYPE_META[incident.detectedType] ?? { icon: '⚠️' };
  const duration = formatDuration(incident.clip?.durationMs ?? null);

  return (
    <li className={cx('card')}>
      <button
        type="button"
        className={cx('thumbnail', incident.detectedType.toLowerCase())}
        disabled={!incident.clip}
        onClick={() => setIsClipModalOpen(true)}
      >
        <span className={cx('recBadge')}>● REC · {dayjs(incident.startedAt).format('MM.DD HH:mm')}</span>
        <span className={cx('typeBadge')}>
          {typeMeta.icon} {incident.detectedTypeLabel}
        </span>
        {incident.clip && (
          <span className={cx('playButton')}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--sb-brand)">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        )}
        {duration && <span className={cx('durationBadge')}>{duration}</span>}
      </button>

      <div className={cx('body')}>
        <div className={cx('bodyHead')}>
          <strong className={cx('location')}>{incident.cameraLabel ?? '삭제된 카메라'}</strong>
          {incident.clipCount > 1 && <span className={cx('clipCount')}>영상 {incident.clipCount}개</span>}
        </div>
        <span className={cx('time')}>{formatDateTime(incident.startedAt)}</span>
        <span className={cx('meta')}>
          {incident.wardName} · {incident.eventCount}회 연속 감지 · 최고 신뢰도 {Math.round(incident.maxConfidence * 100)}%
        </span>
      </div>

      <div className={cx('footer')}>
        <span className={cx('statusBadge', incident.reviewStatus.toLowerCase())}>
          {REVIEW_STATUS_LABEL[incident.reviewStatus]}
        </span>

        {canRespond ? (
          <div className={cx('actions')}>
            <button
              type="button"
              className={cx('actionButton', 'real')}
              disabled={feedbackMutation.isPending}
              onClick={() => handleFeedback('REAL')}
            >
              실제 위험
            </button>
            <button
              type="button"
              className={cx('actionButton', 'falseAlarm')}
              disabled={feedbackMutation.isPending}
              onClick={() => handleFeedback('FALSE_ALARM')}
            >
              오탐
            </button>
          </div>
        ) : (
          incident.myVerdict && (
            <span className={cx('myVerdict')}>내 응답: {incident.myVerdict === 'REAL' ? '실제 위험' : '오탐'}</span>
          )
        )}
      </div>

      {isClipModalOpen && (
        <AnomalyClipModal incidentId={incident.incidentId} onClose={() => setIsClipModalOpen(false)} />
      )}
    </li>
  );
}
