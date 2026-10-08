'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import classNames from 'classnames/bind';

import { AnomalyHistoryContent } from './AnomalyHistoryContent';
import { LiveCameraModal } from './LiveCameraModal';
import styles from './GuardianMonitorContent.module.css';

const cx = classNames.bind(styles);

export default function GuardianMonitorContent() {
  const searchParams = useSearchParams();
  const deepLinkSessionId = searchParams.get('session');
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(Boolean(deepLinkSessionId));
  const [selectedWardId, setSelectedWardId] = useState<string | undefined>(undefined);

  return (
    <div className={cx('page')}>
      <AnomalyHistoryContent
        onViewLive={wardId => {
          setSelectedWardId(wardId);
          setIsLiveModalOpen(true);
        }}
      />

      {isLiveModalOpen && (
        <LiveCameraModal
          initialSessionId={deepLinkSessionId}
          initialWardId={selectedWardId}
          onClose={() => setIsLiveModalOpen(false)}
        />
      )}
    </div>
  );
}
