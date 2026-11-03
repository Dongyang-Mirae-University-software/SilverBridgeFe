import type { Metadata } from 'next';
import { AdminAnnouncementContent } from '../_components/AdminAnnouncementContent';

export const metadata: Metadata = { title: '공지사항 관리' };

export default function AdminNoticesPage() { return <AdminAnnouncementContent />; }
