import type { Metadata } from 'next';
import { AdminNotificationHistoryContent } from '../_components/AdminNotificationHistoryContent';

export const metadata: Metadata = { title: '알림 이력' };

export default function AdminNotificationHistoryPage() {
  return <AdminNotificationHistoryContent />;
}
