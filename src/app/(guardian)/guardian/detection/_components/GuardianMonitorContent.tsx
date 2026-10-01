'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import classNames from 'classnames/bind';

import { Tabs } from '@/components/Tabs';
import { AnomalyHistoryContent } from './AnomalyHistoryContent';
import { MonitorViewer } from './MonitorViewer';
import { SessionList } from './SessionList';
import { useGuardianMonitor } from './useGuardianMonitor';
import styles from './GuardianMonitorContent.module.css';

const cx = classNames.bind(styles);

type DetectionTab = 'live' | 'history';

function getInitialTab(searchParams: ReturnType<typeof useSearchParams>): DetectionTab {
  return searchParams.get('tab') === 'history' ? 'history' : 'live';
}

export default function GuardianMonitorContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<DetectionTab>(() => getInitialTab(searchParams));
  const monitor = useGuardianMonitor();
  const deepLinkSessionId = searchParams.get('session');
  const didDeepLinkRef = useRef(false);

  // 이상감지 FCM 푸시를 눌렀을 때 ?session=으로 넘어온 카메라를 자동 선택
  // (푸시 라우팅은 항상 live 탭 기본값으로 이동하므로 탭 전환은 따로 하지 않는다)
  useEffect(() => {
    if (didDeepLinkRef.current || !deepLinkSessionId) return;
    if (!monitor.sessions.some(session => session.session_id === deepLinkSessionId)) return;
    didDeepLinkRef.current = true;
    monitor.selectSession(deepLinkSessionId);
  }, [deepLinkSessionId, monitor]);

  const handleTabChange = (tab: DetectionTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'history') params.set('tab', 'history');
    else params.delete('tab');
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  };

  return (
    <div className={cx('page')}>
      <Tabs
        ariaLabel="이상감지 탭"
        items={[
          { value: 'live', label: '실시간 모니터링' },
          { value: 'history', label: '감지 이력' },
        ]}
        onChange={handleTabChange}
        size="sm"
        value={activeTab}
      />

      {activeTab === 'live' ? (
        <div className={cx('monitorPage')}>
          <SessionList
            error={monitor.error}
            isAllowlistEmpty={monitor.isAllowlistEmpty}
            isError={monitor.isError}
            isLoading={monitor.isLoading}
            onSelectSession={monitor.selectSession}
            selectedId={monitor.selectedId}
            sessions={monitor.sessions}
          />
          <MonitorViewer
            detectState={monitor.detectState}
            frameSrc={monitor.frameSrc}
            isStoppingSession={monitor.isStoppingSession}
            latestAnalysis={monitor.latestAnalysis}
            latestFrameUrl={monitor.latestFrameUrl}
            onStopSession={monitor.stopSelectedSession}
            selectedId={monitor.selectedId}
            selectedSession={monitor.selectedSession}
            sessionStatus={monitor.sessionStatus}
            viewerUrl={monitor.viewerUrl}
          />
        </div>
      ) : (
        <AnomalyHistoryContent onViewLive={() => handleTabChange('live')} />
      )}
    </div>
  );
}
