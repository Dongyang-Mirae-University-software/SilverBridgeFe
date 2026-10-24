'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import PageLayout from '@/components/layout/PageLayout';
import { getConnectionData } from '@/components/connections/ConnectionShared';
import { guardianConnectionsQueryOptions } from '@/service/query/guardian';
import { AnomalyHistoryContent } from './AnomalyHistoryContent';
import { LiveCameraModal } from './LiveCameraModal';
import styles from './GuardianMonitorContent.module.css';

const cx = classNames.bind(styles);

export default function GuardianMonitorContent() {
  const searchParams = useSearchParams();
  const deepLinkSessionId = searchParams.get('session');
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(Boolean(deepLinkSessionId));
  // 실시간 영상을 열 피보호자. 모달을 연 그 순간의 선택으로 고정한다(열린 뒤 이력에서 바꿔도 영상은 그대로)
  const [liveWardId, setLiveWardId] = useState<string | undefined>(undefined);
  const [selectedWardId, setSelectedWardId] = useState<string | undefined>(undefined);

  const { data: connectionsData } = useQuery(guardianConnectionsQueryOptions);
  const wards = getConnectionData(connectionsData)
    .filter(connection => connection.status === 'ACTIVE')
    .map(connection => ({ wardId: connection.partnerUserId, wardName: connection.partnerName }));
  const activeWardId = selectedWardId ?? wards[0]?.wardId;

  const liveButton = (
    <button
      type="button"
      className={cx('liveButton')}
      onClick={() => {
        setLiveWardId(activeWardId);
        setIsLiveModalOpen(true);
      }}
    >
      <span className={cx('liveDot')} />
      실시간 카메라 보기
    </button>
  );

  return (
    <PageLayout title="이상감지" description="피보호자의 실시간 영상과 AI 화재·낙상·흉기 감지 기록을 확인합니다." actions={liveButton}>
      <AnomalyHistoryContent wards={wards} selectedWardId={activeWardId} onSelectWard={setSelectedWardId} />

      {isLiveModalOpen && (
        <LiveCameraModal
          initialSessionId={deepLinkSessionId}
          initialWardId={liveWardId}
          onClose={() => setIsLiveModalOpen(false)}
        />
      )}
    </PageLayout>
  );
}
