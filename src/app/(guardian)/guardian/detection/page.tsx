import type { Metadata } from 'next';
import GuardianMonitorContent from './_components/GuardianMonitorContent';

export const metadata: Metadata = { title: 'AI 이상감지' };

export default function GuardianDetectionPage() {
  return <GuardianMonitorContent />;
}
