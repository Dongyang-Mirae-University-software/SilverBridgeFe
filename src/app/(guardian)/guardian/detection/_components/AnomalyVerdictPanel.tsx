'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { AnomalyIncident, AnomalyVerdict } from '@/service/interface/guardian/anomaly';
import { useAnomalyFeedbackMutation } from '@/service/query/guardian/anomaly';
import { showToast } from '@/store/toastStore';
import styles from './AnomalyVerdictPanel.module.css';

const cx = classNames.bind(styles);

// 보호자 판정. 1인 1표이고 다시 고르면 덮어쓴다(BE는 언제든 다시 받는다).
// 보이는 결과는 내 표가 아니라 응답한 보호자들의 다수결(reviewStatus)이고, 동수만 CONFLICTED다.
// 다른 보호자가 무엇을 골랐는지는 보여 주지 않는다. 판정은 이미 나간 알림을 되돌리지 않는다.
const VERDICT_LABEL: Record<AnomalyVerdict, string> = {
  REAL: '실제 위험이에요',
  FALSE_ALARM: '괜찮아요',
};

const RESULT_LABEL = {
  REAL: '실제 위험',
  FALSE_ALARM: '괜찮았어요',
} as const;

export function AnomalyVerdictPanel({
  incident,
  size = 'normal',
  prompt,
}: {
  incident: AnomalyIncident;
  size?: 'normal' | 'big';
  // 판정 전 버튼 앞에 둘 안내(영상 화면의 "영상을 보고 알려 주세요")
  prompt?: string;
}) {
  const feedbackMutation = useAnomalyFeedbackMutation();
  const [isEditing, setIsEditing] = useState(false);
  const { reviewStatus, myVerdict } = incident;

  const handleVerdict = (verdict: AnomalyVerdict) => {
    if (feedbackMutation.isPending) return;
    feedbackMutation.mutate(
      { incidentId: incident.incidentId, body: { verdict } },
      {
        onSuccess: () => setIsEditing(false),
        onError: error => {
          const message = (error as { message?: string })?.message ?? '응답을 보내지 못했습니다. 다시 시도해 주세요.';
          showToast(message, { variant: 'error' });
        },
      },
    );
  };

  const buttons = (
    <div className={cx('buttons', size)}>
      {(['REAL', 'FALSE_ALARM'] as const).map(verdict => (
        <button
          key={verdict}
          type="button"
          className={cx('verdictButton', verdict === 'REAL' ? 'real' : 'falseAlarm', { mine: myVerdict === verdict })}
          aria-pressed={myVerdict === verdict}
          disabled={feedbackMutation.isPending}
          onClick={event => {
            event.stopPropagation();
            handleVerdict(verdict);
          }}
        >
          {VERDICT_LABEL[verdict]}
        </button>
      ))}
    </div>
  );

  if (reviewStatus === 'PENDING') {
    return (
      <div className={cx('panel', size)}>
        {prompt && <span className={cx('prompt')}>{prompt}</span>}
        {buttons}
      </div>
    );
  }

  if (reviewStatus === 'CONFLICTED') {
    return (
      <div className={cx('panel', 'stacked', size)}>
        <span className={cx('conflicted')}>다른 보호자와 판정이 달라요. 다시 확인해 주세요.</span>
        {buttons}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={cx('panel', size)}>
        {buttons}
        <button type="button" className={cx('linkButton')} onClick={() => setIsEditing(false)}>
          취소
        </button>
      </div>
    );
  }

  return (
    <div className={cx('panel', size)}>
      <span className={cx('result', reviewStatus === 'REAL' ? 'real' : 'falseAlarm')}>{RESULT_LABEL[reviewStatus]}</span>
      {/* v12 디자인 보관: 다수결 결과와 다른 내 판정을 별도 문구로 노출했다.
          v13은 결과 배지와 되돌리기만 보여 주므로 렌더링하지 않는다.
          {myVerdict && myVerdict !== reviewStatus && <span className={cx('myVerdict')}>내 응답: {VERDICT_LABEL[myVerdict]}</span>} */}
      <button type="button" className={cx('linkButton')} onClick={() => setIsEditing(true)}>
        {myVerdict ? '되돌리기' : '나도 응답하기'}
      </button>
    </div>
  );
}
