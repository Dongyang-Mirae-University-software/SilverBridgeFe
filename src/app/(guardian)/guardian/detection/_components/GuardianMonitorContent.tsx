'use client';


import { MonitorViewer } from './MonitorViewer';
import { SessionList } from './SessionList';
import { useGuardianMonitor } from './useGuardianMonitor';
import styles from './GuardianMonitorContent.module.css';


export default function GuardianMonitorContent() {
  const monitor = useGuardianMonitor();

  return (
    <div className={styles.monitorPage}>
      <SessionList
        error={monitor.error}
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
  );
}
