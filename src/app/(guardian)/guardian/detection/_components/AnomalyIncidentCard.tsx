'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { formatDateTime } from '@/utils/format/date';
import { AnomalyIncident, AnomalyVerdict } from '@/service/interface/guardian/anomaly';
import { useAnomalyFeedbackMutation } from '@/service/query/guardian/anomaly';
import { AnomalyClipModal } from './AnomalyClipModal';
import styles from './AnomalyIncidentCard.module.css';

const cx = classNames.bind(styles);

const REVIEW_STATUS_LABEL: Record<AnomalyIncident['reviewStatus'], string> = {
  PENDING: '확인 필요',
  REAL: '실제 위험',
  FALSE_ALARM: '오탐',
  CONFLICTED: '응답 엇갈림 · 재확인 필요',
};

export function AnomalyIncidentCard({ incident }: { incident: AnomalyIncident }) {
  const feedbackMutation = useAnomalyFeedbackMutation();
  const [isClipModalOpen, setIsClipModalOpen] = useState(false);

  const handleFeedback = (verdict: AnomalyVerdict) => {
    if (feedbackMutation.isPending) return;
    feedbackMutation.mutate({ incidentId: incident.incidentId, body: { verdict } });
  };

  const canRespond = incident.reviewStatus === 'PENDING' || incident.reviewStatus === 'CONFLICTED';

  return (
    <li className={cx('card', incident.detectedType.toLowerCase())}>
      <div className={cx('typeBadge')}>
        {incident.detectedType === 'FIRE' ? '🔥' : '💨'} {incident.detectedTypeLabel}
      </div>

      <div className={cx('body')}>
        <strong className={cx('wardName')}>{incident.wardName}</strong>
        <span className={cx('location')}>{incident.cameraLabel ?? '삭제된 카메라'}</span>
        <span className={cx('time')}>{formatDateTime(incident.startedAt)}</span>
        <span className={cx('meta')}>
          {incident.eventCount}회 연속 감지 · 최고 신뢰도 {Math.round(incident.maxConfidence * 100)}%
        </span>

        {incident.clip && (
          <button type="button" className={cx('clipButton')} onClick={() => setIsClipModalOpen(true)}>
            ▶ 영상 {incident.clipCount}
          </button>
        )}
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
            <span className={cx('myVerdict')}>
              내 응답: {incident.myVerdict === 'REAL' ? '실제 위험' : '오탐'}
            </span>
          )
        )}
      </div>

      {isClipModalOpen && (
        <AnomalyClipModal incidentId={incident.incidentId} onClose={() => setIsClipModalOpen(false)} />
      )}
    </li>
  );
}
