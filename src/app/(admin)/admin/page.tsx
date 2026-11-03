import type { Metadata } from 'next';
import { AdminDashboardContent } from './_components/AdminDashboardContent';

export const metadata: Metadata = { title: '관리자 대시보드' };

export default function AdminPage() {
  return <AdminDashboardContent />;
}
