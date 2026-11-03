import type { Metadata } from 'next';
import { AdminAiStatsContent } from '../_components/AdminAiStatsContent';

export const metadata: Metadata = { title: 'AI 통계' };

export default function AdminAiStatsPage() {
  return <AdminAiStatsContent />;
}
